<?php
// Shared rules for ticket bundles. A package is one purchasable unit (and has
// one price), while ticketCount says how many people that unit admits.

declare(strict_types=1);

const MAX_TICKETS_PER_PACKAGE = 50;
const MAX_TICKETS_PER_ORDER = 50;

function normalise_ticket_count($value): int
{
    return max(1, min(MAX_TICKETS_PER_PACKAGE, (int) $value));
}

function ticket_admission_quantity(int $packageQuantity, $ticketsPerPackage): int
{
    return max(1, $packageQuantity) * normalise_ticket_count($ticketsPerPackage);
}

function max_ticket_package_purchase_quantity($ticketsPerPackage): int
{
    // Bundles are intentionally one per checkout. Single-ticket tiers retain
    // the ability to buy several tickets in one transaction.
    return normalise_ticket_count($ticketsPerPackage) > 1 ? 1 : MAX_TICKETS_PER_ORDER;
}

// Ticket prices are stored as either integers (the newer family fields) or as
// display strings such as "KES 1,200" (legacy/standard packages).
function ticket_price_to_int($value): int
{
    return max(0, (int) preg_replace('/[^0-9]/', '', (string) $value));
}

function family_group_unit_price(int $basePrice, array $group): int
{
    $pricing = (array) ($group['pricing'] ?? []);
    $type = $pricing['type'] ?? 'full';
    $value = max(0, (int) ($pricing['value'] ?? 0));

    if ($type === 'fixed') return $value;
    if ($type === 'percent') {
        return max(0, (int) round($basePrice * (1 - min(100, $value) / 100)));
    }
    return $basePrice;
}

// Cheapest valid starting price, used only for the package card's "From"
// label. Checkout still resolves the buyer's exact composition independently.
function family_package_minimum_amount(array $package): int
{
    $family = (array) ($package['family'] ?? []);
    $basePrice = ticket_price_to_int($family['basePrice'] ?? 0);
    $groups = array_values(array_filter((array) ($family['groups'] ?? []), 'is_array'));
    if ($basePrice < 1 || !$groups) return 0;

    $minimumMembers = max(1, min(MAX_TICKETS_PER_PACKAGE, (int) ($family['minMembers'] ?? 1)));
    $count = 0;
    $amount = 0;
    $available = [];

    foreach ($groups as $group) {
        $min = max(0, min(MAX_TICKETS_PER_PACKAGE, (int) ($group['min'] ?? 0)));
        $max = max($min, min(MAX_TICKETS_PER_PACKAGE, (int) ($group['max'] ?? $min)));
        $unit = family_group_unit_price($basePrice, $group);
        $count += $min;
        $amount += $min * $unit;
        if ($max > $min) $available[] = ['room' => $max - $min, 'unit' => $unit];
    }

    usort($available, fn($a, $b) => $a['unit'] <=> $b['unit']);
    $needed = max(0, $minimumMembers - $count);
    foreach ($available as $slot) {
        if ($needed === 0) break;
        $take = min($needed, $slot['room']);
        $amount += $take * $slot['unit'];
        $needed -= $take;
    }

    return $needed === 0 ? $amount : 0;
}

// Resolve untrusted buyer counts against the package stored by the server.
// Returns [composition, ticket metadata, total, error]. No price supplied by
// the browser is ever read here.
function resolve_family_composition(array $package, $sent): array
{
    $family = (array) ($package['family'] ?? []);
    $basePrice = ticket_price_to_int($family['basePrice'] ?? 0);
    $groups = array_values(array_filter((array) ($family['groups'] ?? []), 'is_array'));
    if ($basePrice < 1 || !$groups) {
        return [[], [], 0, 'This family package is not configured correctly.'];
    }

    $picked = [];
    foreach ((array) $sent as $row) {
        if (!is_array($row)) continue;
        $id = trim((string) ($row['id'] ?? ''));
        if ($id === '') continue;
        if (isset($picked[$id])) {
            return [[], [], 0, 'A family member category was submitted more than once.'];
        }
        $picked[$id] = (int) ($row['quantity'] ?? 0);
    }

    $declaredIds = [];
    foreach ($groups as $group) $declaredIds[(string) ($group['id'] ?? '')] = true;
    foreach ($picked as $id => $_quantity) {
        if (!isset($declaredIds[$id])) {
            return [[], [], 0, 'That family member category is no longer available.'];
        }
    }

    $composition = [];
    $tickets = [];
    $memberCount = 0;
    $amount = 0;

    foreach ($groups as $group) {
        $id = (string) ($group['id'] ?? '');
        $label = trim((string) ($group['label'] ?? 'Family member'));
        $ageLabel = trim((string) ($group['ageLabel'] ?? ''));
        $min = max(0, min(MAX_TICKETS_PER_PACKAGE, (int) ($group['min'] ?? 0)));
        $max = max($min, min(MAX_TICKETS_PER_PACKAGE, (int) ($group['max'] ?? $min)));
        $quantity = $picked[$id] ?? 0;

        if ($quantity < $min || $quantity > $max) {
            return [
                [], [], 0,
                "$label must have between $min and $max " . ($max === 1 ? 'person' : 'people') . '.',
            ];
        }
        if ($quantity === 0) continue;

        $unit = family_group_unit_price($basePrice, $group);
        $lineAmount = $unit * $quantity;
        $composition[] = [
            'id'        => $id,
            'label'     => $label,
            'ageLabel'  => $ageLabel,
            'quantity'  => $quantity,
            'unitPrice' => $unit,
            'amount'    => $lineAmount,
        ];
        for ($i = 0; $i < $quantity; $i++) {
            $tickets[] = [
                'memberType'  => $id,
                'memberLabel' => $label,
                'ageLabel'    => $ageLabel,
            ];
        }
        $memberCount += $quantity;
        $amount += $lineAmount;
    }

    $minMembers = max(1, min(MAX_TICKETS_PER_PACKAGE, (int) ($family['minMembers'] ?? 1)));
    $maxMembers = max($minMembers, min(MAX_TICKETS_PER_PACKAGE, (int) ($family['maxMembers'] ?? MAX_TICKETS_PER_PACKAGE)));
    if ($memberCount < $minMembers || $memberCount > $maxMembers) {
        return [
            [], [], 0,
            "This family package is for $minMembers to $maxMembers people.",
        ];
    }
    if ($amount < 1) return [[], [], 0, 'This family composition has no payable amount.'];

    return [$composition, $tickets, $amount, null];
}
