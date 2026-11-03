<?php
// Validation and shaping for tickets issued directly by an administrator.
//
// These are real admission tickets, not synthetic payments: they receive the
// same codes, PDFs, email delivery and door checks as a paid order, while the
// explicit billingType keeps them out of revenue and payment reconciliation.

declare(strict_types=1);

const COMPLIMENTARY_GENERAL_ADMISSION = 'General admission';

function complimentary_text($value, int $maxLength): string
{
    if (!is_string($value)) return '';
    $value = trim($value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value);
    return mb_substr((string) $value, 0, $maxLength);
}

// Resolve every client-provided choice against the stored event catalogue.
// Throws a domain error so the HTTP endpoint can turn it into a useful 422/404
// response, while this decision remains straightforward to test in isolation.
function resolve_complimentary_ticket_request(array $input, array $events): array
{
    $eventSlug = complimentary_text($input['eventSlug'] ?? '', 120);
    $packageName = complimentary_text($input['packageName'] ?? '', 80);
    $quantity = (int) ($input['quantity'] ?? 0);
    $customer = is_array($input['customer'] ?? null) ? $input['customer'] : [];

    $preferredName = complimentary_text($customer['preferredName'] ?? '', 80);
    $otherNames = complimentary_text($customer['otherNames'] ?? '', 120);
    $email = complimentary_text($customer['email'] ?? '', 160);
    $phone = complimentary_text($customer['phone'] ?? '', 20);
    $note = complimentary_text($input['note'] ?? '', 240);

    if ($preferredName === '') {
        throw new DomainException('Please enter the recipient\'s preferred name.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new DomainException('Please enter a valid recipient email.');
    }
    if ($quantity < 1 || $quantity > 50) {
        throw new DomainException('Issue between 1 and 50 tickets at a time.');
    }

    $event = null;
    foreach ($events as $candidate) {
        if (is_array($candidate) && ($candidate['slug'] ?? '') === $eventSlug) {
            $event = $candidate;
            break;
        }
    }
    if ($event === null) {
        throw new OutOfBoundsException('Event not found.');
    }

    $packages = array_values(array_filter((array) ($event['packages'] ?? []), 'is_array'));
    if (!$packages) {
        // Events without commercial packages can still have named guests.
        $packageName = COMPLIMENTARY_GENERAL_ADMISSION;
        $sourcePackageType = 'standard';
    } else {
        $package = null;
        foreach ($packages as $candidate) {
            if (($candidate['name'] ?? '') === $packageName) {
                $package = $candidate;
                break;
            }
        }
        if ($package === null) {
            throw new OutOfBoundsException('That ticket package is no longer available.');
        }
        $sourcePackageType = in_array(($package['type'] ?? 'standard'), ['standard', 'family', 'group'], true)
            ? ($package['type'] ?? 'standard')
            : 'standard';
    }

    return [
        'event' => $event,
        'packageName' => $packageName,
        // A grant names individual admissions. Commercial bundle sizes and
        // family/group payment rules do not multiply a complimentary issue.
        'quantity' => $quantity,
        'sourcePackageType' => $sourcePackageType,
        'customer' => [
            'preferredName' => $preferredName,
            'otherNames' => $otherNames,
            'email' => $email,
            'phone' => $phone,
        ],
        'note' => $note,
    ];
}

function make_complimentary_order(array $resolved, array $orders): array
{
    $quantity = (int) $resolved['quantity'];
    $codes = mint_ticket_codes($orders, $quantity);
    $now = date('c');

    return [
        'id' => bin2hex(random_bytes(12)),
        'ticketCode' => $codes[0],
        'tickets' => array_map(
            fn(string $code) => ['code' => $code, 'admittedAt' => null],
            $codes
        ),
        'createdAt' => $now,
        'issuedAt' => $now,
        'status' => 'success',
        'eventSlug' => $resolved['event']['slug'],
        'eventTitle' => $resolved['event']['title'],
        'eventDate' => $resolved['event']['date'] ?? '',
        'eventVenue' => $resolved['event']['venue'] ?? '',
        'itemType' => 'ticket',
        'itemName' => $resolved['packageName'],
        // Keep email wording generic (N individual tickets), while preserving
        // the source type as audit metadata.
        'packageType' => 'complimentary',
        'sourcePackageType' => $resolved['sourcePackageType'],
        'unitPrice' => 0,
        'options' => [],
        'openAmount' => false,
        'packageQuantity' => $quantity,
        'ticketsPerPackage' => 1,
        'quantity' => $quantity,
        'familyComposition' => [],
        'groupToken' => null,
        'groupName' => null,
        'groupCapacity' => null,
        'itemAmount' => 0,
        'addOns' => [],
        'addOnAmount' => 0,
        'amount' => 0,
        'promoCode' => '',
        'customer' => $resolved['customer'],
        'mpesaPhone' => null,
        'checkoutRequestId' => '',
        'merchantRequestId' => '',
        'paymentReference' => null,
        'receipt' => null,
        'resultDesc' => 'Complimentary tickets issued by an administrator.',
        'emailed' => false,
        'emailOk' => null,
        'paidAt' => null,
        'settledBy' => 'admin-issuance',
        'billingType' => 'complimentary',
        'complimentary' => true,
        'issuedBy' => 'admin',
        'issuedNote' => $resolved['note'],
        'lastQueryAt' => 0,
    ];
}
