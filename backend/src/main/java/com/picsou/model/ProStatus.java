package com.picsou.model;

public enum ProStatus {
    PERSO,
    PRO_A_REMBOURSER,
    PRO_ABSORBE,
    NON_CLASSE,
    /** One leg of a transfer between two of the member's own accounts (e.g. Revolut
     * "Petite monnaie" <-> "Courant Revolut") -- not a real expense or income, excluded
     * from the expense dashboard's totals and category breakdown. */
    VIREMENT_INTERNE
}
