package com.picsou.repository;

import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.model.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByAccountIdOrderByDateDesc(Long accountId);

    Optional<Transaction> findByIdAndAccountId(Long id, Long accountId);

    /** Provider ids already stored for this account, to dedupe an incoming sync batch
     * in memory rather than one exists-query per fetched transaction. */
    @Query("SELECT t.externalTransactionId FROM Transaction t "
        + "WHERE t.account.id = :accountId AND t.externalTransactionId IS NOT NULL")
    List<String> findExternalTransactionIdsByAccountId(@Param("accountId") Long accountId);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.account.id = :accountId")
    BigDecimal sumAmountByAccountId(@Param("accountId") Long accountId);

    void deleteByAccountId(Long accountId);

    void deleteByAccountIdAndIsManualFalse(Long accountId);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.account.id = :accountId AND t.date > :date")
    BigDecimal sumAmountByAccountIdAndDateAfter(@Param("accountId") Long accountId, @Param("date") LocalDate date);

    List<Transaction> findByAccountIdAndTxTypeInOrderByDateAscIdAsc(Long accountId, List<TransactionType> types);

    /** Earliest transaction date across all accounts */
    @Query("SELECT MIN(t.date) FROM Transaction t")
    LocalDate findEarliestDate();

    /**
     * Manually entered transactions of manual accounts whose ticker is 12 characters long — the
     * length of an ISIN, which the caller confirms with {@code OpenFigiIsinConverter.isIsin}
     * before touching anything. Such a ticker is one an earlier ISIN resolution failed to convert:
     * it can never be priced, since the Yahoo provider rejects ISIN-shaped strings outright.
     *
     * <p>Synced transactions and synced accounts are excluded on purpose: their adapters re-resolve
     * every ISIN on each sync, so they repair themselves without rewriting rows a provider owns.
     *
     * <p>No {@code member_id} predicate, unlike every request-scoped query: this feeds a startup
     * maintenance pass with no caller and no member context, in the same family as
     * {@code PriceFxCleanupRunner} (purges {@code price_snapshot} wholesale) and
     * {@code SchedulerService.dailySnapshots} (iterates every member). The tenant-isolation rule
     * protects paths where a caller's identity decides what may be read; a member loop here would
     * iterate all members and touch exactly the same rows.
     */
    @Query("SELECT t FROM Transaction t "
        + "WHERE t.isManual = true AND t.account.isManual = true AND LENGTH(t.ticker) = 12")
    List<Transaction> findManualTransactionsWithIsinLengthTicker();

    /**
     * Accounts holding the given manual tickers. Read before a repair pass rewrites those tickers,
     * so the accounts whose holdings need recomputing are known while they can still be found by
     * the old value. Ids rather than entities: the caller runs outside a transaction, where a lazy
     * {@code t.account} would not be readable.
     */
    @Query("SELECT DISTINCT t.account.id FROM Transaction t "
        + "WHERE t.isManual = true AND t.account.isManual = true AND t.ticker IN :tickers")
    List<Long> findManualAccountIdsByTickerIn(@Param("tickers") Collection<String> tickers);

    Optional<Transaction> findByIdAndAccount_Member_Id(Long id, Long memberId);

    List<Transaction> findByReimbursementId(Long reimbursementId);

    List<Transaction> findByAccount_Member_IdAndDateBetween(Long memberId, LocalDate from, LocalDate to);

    @Query("SELECT t FROM Transaction t WHERE t.account.member.id = :memberId "
        + "AND t.proStatus = :proStatus AND t.reimbursementStatus = :reimbursementStatus ORDER BY t.date DESC")
    List<Transaction> findByMemberAndProStatusAndReimbursementStatus(
        @Param("memberId") Long memberId,
        @Param("proStatus") ProStatus proStatus,
        @Param("reimbursementStatus") ReimbursementStatus reimbursementStatus);

    /** Positive-amount transactions not already used as the credit side of a reimbursement --
     * i.e. eligible to be picked as a new reimbursement's credit transaction. */
    @Query("SELECT t FROM Transaction t WHERE t.account.member.id = :memberId AND t.amount > 0 "
        + "AND t.id NOT IN (SELECT r.transaction.id FROM Reimbursement r) ORDER BY t.date DESC")
    List<Transaction> findCandidateCreditTransactionsByMemberId(@Param("memberId") Long memberId);

    /** Un-links every expense of a deleted reimbursement in one statement, resetting them back to
     * EN_ATTENTE -- used by ReimbursementService.delete() before removing the Reimbursement row,
     * since ON DELETE SET NULL alone would clear reimbursement_id but not reimbursement_status. */
    @Modifying
    @Query("UPDATE Transaction t SET t.reimbursementId = NULL, t.reimbursementStatus = com.picsou.model.ReimbursementStatus.EN_ATTENTE "
        + "WHERE t.reimbursementId = :reimbursementId")
    void clearReimbursementLinks(@Param("reimbursementId") Long reimbursementId);
}
