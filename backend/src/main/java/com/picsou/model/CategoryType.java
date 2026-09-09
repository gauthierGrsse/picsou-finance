package com.picsou.model;

/** Which side of the ledger a category makes sense for -- lets the transaction context menu
 * stop offering "Restauration" when categorizing a salary credit. Purely a UI filter: it
 * doesn't affect how the expense dashboard sums or excludes anything. */
public enum CategoryType {
    EXPENSE,
    INCOME,
    BOTH
}
