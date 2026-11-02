package com.picsou.dto;

import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;

import java.math.BigDecimal;
import java.util.Collection;

/**
 * What an envelope's {@code spent} is made of, by how each transaction was classified. The four
 * spending buckets add up to {@code spent}; {@code reimbursed} is the professional spend that has
 * been paid back, which the envelope leaves out (like the expense dashboard does) and which is
 * reported here only so the gap with the raw category total is explained. Outflows are positive,
 * so a refund lowers its bucket.
 */
public record BudgetProBreakdown(
    BigDecimal perso,
    BigDecimal proAbsorbe,
    /** Professional spend still waiting for its reimbursement: the cash has left the account. */
    BigDecimal proPending,
    BigDecimal unclassified,
    BigDecimal reimbursed
) {
    public static BudgetProBreakdown of(Collection<Transaction> transactions) {
        BigDecimal perso = BigDecimal.ZERO;
        BigDecimal proAbsorbe = BigDecimal.ZERO;
        BigDecimal proPending = BigDecimal.ZERO;
        BigDecimal unclassified = BigDecimal.ZERO;
        BigDecimal reimbursed = BigDecimal.ZERO;
        for (Transaction t : transactions) {
            ProStatus status = t.getProStatus();
            // The other leg of an own-account transfer is neither spending nor income.
            if (status == ProStatus.VIREMENT_INTERNE) continue;
            BigDecimal outflow = t.getAmount().negate();
            if (t.isSettledReimbursement()) {
                reimbursed = reimbursed.add(outflow);
            } else if (status == ProStatus.PERSO) {
                perso = perso.add(outflow);
            } else if (status == ProStatus.PRO_ABSORBE) {
                proAbsorbe = proAbsorbe.add(outflow);
            } else if (status == ProStatus.PRO_A_REMBOURSER) {
                proPending = proPending.add(outflow);
            } else {
                unclassified = unclassified.add(outflow);
            }
        }
        return new BudgetProBreakdown(perso, proAbsorbe, proPending, unclassified, reimbursed);
    }

    /** What counts toward the envelope: everything but the settled reimbursements. */
    public BigDecimal spent() {
        return perso.add(proAbsorbe).add(proPending).add(unclassified);
    }
}
