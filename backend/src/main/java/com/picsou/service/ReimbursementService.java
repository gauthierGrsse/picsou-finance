package com.picsou.service;

import com.picsou.dto.LinkExpensesRequest;
import com.picsou.dto.PendingReimbursementsResponse;
import com.picsou.dto.ReimbursementRequest;
import com.picsou.dto.ReimbursementResponse;
import com.picsou.dto.TransactionResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.ProStatus;
import com.picsou.model.Reimbursement;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.ReimbursementRepository;
import com.picsou.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ReimbursementService {

    private final ReimbursementRepository reimbursementRepository;
    private final TransactionRepository transactionRepository;
    private final FamilyMemberRepository familyMemberRepository;

    public ReimbursementService(
        ReimbursementRepository reimbursementRepository,
        TransactionRepository transactionRepository,
        FamilyMemberRepository familyMemberRepository
    ) {
        this.reimbursementRepository = reimbursementRepository;
        this.transactionRepository = transactionRepository;
        this.familyMemberRepository = familyMemberRepository;
    }

    public List<ReimbursementResponse> findAll(Long memberId) {
        return reimbursementRepository.findAllByMemberIdOrderByCreatedAtDesc(memberId).stream()
            .map(this::toResponse)
            .toList();
    }

    public ReimbursementResponse findById(Long id, Long memberId) {
        return toResponse(getOrThrow(id, memberId));
    }

    public PendingReimbursementsResponse findPending(Long memberId) {
        List<Transaction> expenses = transactionRepository.findByMemberAndProStatusAndReimbursementStatus(
            memberId, ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.EN_ATTENTE);
        BigDecimal total = expenses.stream()
            .map(Transaction::getAmount)
            .map(BigDecimal::abs)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new PendingReimbursementsResponse(expenses.stream().map(TransactionResponse::from).toList(), total);
    }

    public List<TransactionResponse> findCandidateCredits(Long memberId) {
        return transactionRepository.findCandidateCreditTransactionsByMemberId(memberId).stream()
            .map(TransactionResponse::from)
            .toList();
    }

    @Transactional
    public ReimbursementResponse create(ReimbursementRequest req, Long memberId) {
        Transaction credit = requireCandidateCredit(req.creditTransactionId(), memberId);

        Reimbursement reimbursement = Reimbursement.builder()
            .member(familyMemberRepository.getReferenceById(memberId))
            .transaction(credit)
            .build();
        reimbursement = reimbursementRepository.save(reimbursement);

        linkExpenses(reimbursement, req.expenseTransactionIds(), memberId);
        return toResponse(reimbursement);
    }

    @Transactional
    public ReimbursementResponse addExpenses(Long id, LinkExpensesRequest req, Long memberId) {
        Reimbursement reimbursement = getOrThrow(id, memberId);
        linkExpenses(reimbursement, req.expenseTransactionIds(), memberId);
        return toResponse(reimbursement);
    }

    @Transactional
    public void unlinkExpense(Long id, Long expenseTxId, Long memberId) {
        Reimbursement reimbursement = getOrThrow(id, memberId);
        Transaction expense = transactionRepository.findByIdAndAccount_Member_Id(expenseTxId, memberId)
            .orElseThrow(() -> ResourceNotFoundException.transaction(expenseTxId));
        if (!reimbursement.getId().equals(expense.getReimbursementId())) {
            throw new IllegalArgumentException("Expense is not linked to this reimbursement");
        }
        expense.setReimbursementId(null);
        expense.setReimbursementStatus(ReimbursementStatus.EN_ATTENTE);
        transactionRepository.save(expense);
    }

    /** Un-links every remaining expense back to EN_ATTENTE before deleting the row -- relying on
     * ON DELETE SET NULL alone would clear reimbursement_id but leave reimbursement_status stuck
     * at REMBOURSE. */
    @Transactional
    public void delete(Long id, Long memberId) {
        Reimbursement reimbursement = getOrThrow(id, memberId);
        transactionRepository.clearReimbursementLinks(reimbursement.getId());
        reimbursementRepository.delete(reimbursement);
    }

    private void linkExpenses(Reimbursement reimbursement, List<Long> expenseTransactionIds, Long memberId) {
        for (Long expenseTxId : expenseTransactionIds) {
            Transaction expense = transactionRepository.findByIdAndAccount_Member_Id(expenseTxId, memberId)
                .orElseThrow(() -> ResourceNotFoundException.transaction(expenseTxId));
            if (expense.getProStatus() != ProStatus.PRO_A_REMBOURSER) {
                throw new IllegalArgumentException("Transaction " + expenseTxId + " is not marked pro_a_rembourser");
            }
            if (expense.getReimbursementId() != null) {
                throw new IllegalArgumentException("Transaction " + expenseTxId + " is already linked to a reimbursement");
            }
            expense.setReimbursementId(reimbursement.getId());
            expense.setReimbursementStatus(ReimbursementStatus.REMBOURSE);
            transactionRepository.save(expense);
        }
    }

    private Transaction requireCandidateCredit(Long transactionId, Long memberId) {
        Transaction credit = transactionRepository.findByIdAndAccount_Member_Id(transactionId, memberId)
            .orElseThrow(() -> ResourceNotFoundException.transaction(transactionId));
        if (credit.getAmount().signum() <= 0) {
            throw new IllegalArgumentException("Credit transaction must have a positive amount");
        }
        if (reimbursementRepository.existsByTransactionId(transactionId)) {
            throw new IllegalArgumentException("Transaction " + transactionId + " is already used as a reimbursement credit");
        }
        return credit;
    }

    private ReimbursementResponse toResponse(Reimbursement reimbursement) {
        List<TransactionResponse> expenses = transactionRepository.findByReimbursementId(reimbursement.getId()).stream()
            .map(TransactionResponse::from)
            .toList();
        return ReimbursementResponse.from(reimbursement, expenses);
    }

    private Reimbursement getOrThrow(Long id, Long memberId) {
        return reimbursementRepository.findByIdAndMemberId(id, memberId)
            .orElseThrow(() -> ResourceNotFoundException.reimbursement(id));
    }
}
