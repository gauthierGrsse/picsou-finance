package com.picsou.service;

import com.picsou.dto.SuggestedTransferPairResponse;
import com.picsou.dto.TransactionResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.ProStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Detects transfers between two of the member's own accounts (e.g. Revolut's "Petite
 * monnaie" <-> "Courant Revolut") so they can be excluded from the expense dashboard --
 * moving your own money isn't spending or income.
 *
 * <p>Two confidence tiers:
 * <ul>
 *   <li><b>Certain, auto-linked</b>: two unclassified transactions on different accounts
 *   of the same member share the exact same {@code external_transaction_id} with exactly
 *   opposite amounts. Enable Banking (Revolut, specifically, so far) reports both legs of
 *   an internal transfer under the same provider reference -- that's the bank's own system
 *   confirming it, not a guess from proximity.</li>
 *   <li><b>Probable, suggested</b>: opposite exact amounts within a few days of each other
 *   on different accounts, but no shared reference. Surfaced for the user to confirm with
 *   one click, never applied silently -- a coincidental equal amount is not proof.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class InternalTransferService {

    private static final Logger log = LoggerFactory.getLogger(InternalTransferService.class);

    /** How many days apart two legs of a suggested (unreferenced) transfer may be. */
    private static final int SUGGESTION_WINDOW_DAYS = 3;

    private final TransactionRepository transactionRepository;

    public InternalTransferService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    /**
     * Called after a sync saves new transactions for one account. Only ever touches rows
     * still at the default {@code NON_CLASSE} -- a transaction the user has already
     * classified is never silently overwritten, certain match or not.
     *
     * @return how many pairs were linked, for the caller's log line.
     */
    @Transactional
    public int autoLinkByReference(Long memberId) {
        List<Transaction> pool = unclassifiedUnlinkedPool(memberId);

        Map<String, List<Transaction>> byExternalId = pool.stream()
            .filter(t -> t.getExternalTransactionId() != null)
            .collect(Collectors.groupingBy(Transaction::getExternalTransactionId));

        int linked = 0;
        for (List<Transaction> group : byExternalId.values()) {
            // Exactly two legs, opposite amounts: the shape of one transfer. A group of any
            // other size (one, or three+) isn't a pair this can link with confidence.
            if (group.size() != 2) continue;
            Transaction a = group.get(0);
            Transaction b = group.get(1);
            if (a.getAmount().compareTo(b.getAmount().negate()) != 0) continue;

            link(a, b);
            linked++;
        }
        if (linked > 0) {
            log.info("Auto-linked {} internal transfer pair(s) for member {} by shared provider reference", linked, memberId);
        }
        return linked;
    }

    /**
     * The full unclassified, unlinked pool for manual linking -- e.g. a wire to a
     * brokerage account that settles too late for {@link #findSuggestions}'s date window
     * to catch. The frontend narrows this to opposite-amount matches for the one
     * transaction the user is linking from; {@link #confirmLink} re-validates regardless.
     */
    public List<TransactionResponse> findCandidates(Long memberId) {
        return unclassifiedUnlinkedPool(memberId).stream()
            .sorted(Comparator.comparing(Transaction::getDate).reversed())
            .map(TransactionResponse::from)
            .toList();
    }

    /**
     * Same-amount, opposite-sign pairs across different accounts within
     * {@link #SUGGESTION_WINDOW_DAYS} days that {@link #autoLinkByReference} could not
     * already resolve (no shared reference) -- left for the user to confirm.
     */
    public List<SuggestedTransferPairResponse> findSuggestions(Long memberId) {
        List<Transaction> pool = unclassifiedUnlinkedPool(memberId);
        List<SuggestedTransferPairResponse> suggestions = new ArrayList<>();
        Set<Long> claimed = new HashSet<>();

        List<Transaction> sorted = pool.stream()
            .sorted(Comparator.comparing(Transaction::getDate))
            .toList();

        for (int i = 0; i < sorted.size(); i++) {
            Transaction a = sorted.get(i);
            if (claimed.contains(a.getId())) continue;
            for (int j = i + 1; j < sorted.size(); j++) {
                Transaction b = sorted.get(j);
                if (claimed.contains(b.getId())) continue;
                long daysApart = Math.abs(ChronoUnit.DAYS.between(a.getDate(), b.getDate()));
                if (daysApart > SUGGESTION_WINDOW_DAYS) break; // sorted by date: nothing further can match either

                if (a.getAccount().getId().equals(b.getAccount().getId())) continue;
                if (a.getAmount().compareTo(b.getAmount().negate()) != 0) continue;

                suggestions.add(new SuggestedTransferPairResponse(TransactionResponse.from(a), TransactionResponse.from(b)));
                claimed.add(a.getId());
                claimed.add(b.getId());
                break;
            }
        }
        return suggestions;
    }

    /** Manually confirms a suggested (or any other) pair. Validated server-side rather than
     * trusted from the request -- a tampered pair must not be linkable.
     *
     * @param allowAmountMismatch skips the opposite-amount check for a transfer that legitimately
     *                            settles at a different figure (brokerage fees, FX conversion) --
     *                            the caller is expected to have gotten explicit user confirmation
     *                            first, since this is the one guard rail an accidental submission
     *                            would otherwise catch.
     */
    @Transactional
    public void confirmLink(Long transactionIdA, Long transactionIdB, Long memberId, boolean allowAmountMismatch) {
        Transaction a = getOrThrow(transactionIdA, memberId);
        Transaction b = getOrThrow(transactionIdB, memberId);

        if (a.getAccount().getId().equals(b.getAccount().getId())) {
            throw new IllegalArgumentException("Both transactions belong to the same account");
        }
        if (!allowAmountMismatch && a.getAmount().compareTo(b.getAmount().negate()) != 0) {
            throw new IllegalArgumentException("Transactions must have exactly opposite amounts");
        }
        if (a.getLinkedTransactionId() != null || b.getLinkedTransactionId() != null) {
            throw new IllegalArgumentException("One of these transactions is already linked");
        }

        link(a, b);
    }

    /** Reverts this leg (and its counterpart, if any) to NON_CLASSE, undoing a mistaken
     * auto-link, confirmation, or {@link #markWithoutMatch}. {@code linkedTransactionId}
     * is null for a solo mark, so only that one row is touched. */
    @Transactional
    public void unlink(Long transactionId, Long memberId) {
        Transaction a = getOrThrow(transactionId, memberId);
        if (a.getProStatus() != ProStatus.VIREMENT_INTERNE) {
            throw new IllegalArgumentException("Transaction is not marked as an internal transfer");
        }
        Long linkedId = a.getLinkedTransactionId();

        a.setProStatus(ProStatus.NON_CLASSE);
        a.setLinkedTransactionId(null);
        transactionRepository.save(a);

        if (linkedId != null) {
            transactionRepository.findByIdAndAccount_Member_Id(linkedId, memberId).ifPresent(b -> {
                b.setProStatus(ProStatus.NON_CLASSE);
                b.setLinkedTransactionId(null);
                transactionRepository.save(b);
            });
        }
    }

    /**
     * Marks a single transaction as an internal transfer with no counterpart row to point
     * at -- for a destination that Picsou never syncs transactions for at all (e.g. a
     * Trade Republic account, which only syncs balance and positions), so no matching
     * "other side" can ever appear in {@link #findCandidates}. The user is vouching for it
     * directly instead of the two-sided proof {@link #confirmLink} normally requires.
     */
    @Transactional
    public void markWithoutMatch(Long transactionId, Long memberId) {
        Transaction a = getOrThrow(transactionId, memberId);
        if (a.getProStatus() == ProStatus.VIREMENT_INTERNE) {
            throw new IllegalArgumentException("Transaction is already marked as an internal transfer");
        }
        a.setProStatus(ProStatus.VIREMENT_INTERNE);
        a.setLinkedTransactionId(null);
        transactionRepository.save(a);
    }

    private void link(Transaction a, Transaction b) {
        a.setProStatus(ProStatus.VIREMENT_INTERNE);
        a.setLinkedTransactionId(b.getId());
        b.setProStatus(ProStatus.VIREMENT_INTERNE);
        b.setLinkedTransactionId(a.getId());
        transactionRepository.save(a);
        transactionRepository.save(b);
    }

    private List<Transaction> unclassifiedUnlinkedPool(Long memberId) {
        return transactionRepository.findByAccount_Member_IdAndProStatusAndLinkedTransactionIdIsNull(
            memberId, ProStatus.NON_CLASSE);
    }

    private Transaction getOrThrow(Long transactionId, Long memberId) {
        return transactionRepository.findByIdAndAccount_Member_Id(transactionId, memberId)
            .orElseThrow(() -> ResourceNotFoundException.transaction(transactionId));
    }
}
