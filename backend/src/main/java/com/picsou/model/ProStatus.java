package com.picsou.model;

public enum ProStatus {
    PERSO,
    /** A professional expense paid from a personal account, to be reimbursed later. Stays
     * PRO_A_REMBOURSER even once the reimbursement lands (see {@link ReimbursementStatus#REMBOURSE}) --
     * that flag only marks the reimbursement, it never rewrites this classification. The
     * expense dashboard reads both together: once reimbursed, it's a net-zero round-trip and
     * is excluded from totals and category breakdown; while still pending, the cash has
     * genuinely left the account, so it still counts. */
    PRO_A_REMBOURSER,
    PRO_ABSORBE,
    NON_CLASSE,
    /** One leg of a transfer between two of the member's own accounts (e.g. Revolut
     * "Petite monnaie" <-> "Courant Revolut") -- not a real expense or income, excluded
     * from the expense dashboard's totals and category breakdown. */
    VIREMENT_INTERNE
}
