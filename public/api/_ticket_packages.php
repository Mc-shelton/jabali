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
