package com.picsou.service;

import com.picsou.dto.TransactionClassificationRequest;
import com.picsou.dto.TransactionResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Account;
import com.picsou.model.ProStatus;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.AccountRepository;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sets a transaction's pro_status / expense_category, independently of
 * {@link ManualTransactionService}. Deliberately separate: ManualTransactionService's edit path
 * is guarded to manual transactions only (it owns the core fields a sync provider writes), but
 * classification must work on every transaction -- synced ones (e.g. Revolut) are the primary
 * case this feature exists for.
 */
@Service
@RequiredArgsConstructor
public class TransactionClassificationService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;

    @Transactional
    public TransactionResponse updateClassification(
        Long accountId, Long txId, Long memberId, TransactionClassificationRequest req
    ) {
        Account account = accountRepository.findByIdAndMemberId(accountId, memberId)
            .orElseThrow(() -> ResourceNotFoundException.account(accountId));
        Transaction tx = transactionRepository.findByIdAndAccountId(txId, account.getId())
            .orElseThrow(() -> ResourceNotFoundException.transaction(txId));

        if (req.expenseCategoryId() != null) {
            expenseCategoryRepository.findByIdAndMemberId(req.expenseCategoryId(), memberId)
                .orElseThrow(() -> ResourceNotFoundException.expenseCategory(req.expenseCategoryId()));
        }
        tx.setExpenseCategoryId(req.expenseCategoryId());

        if (req.proStatus() != ProStatus.PRO_A_REMBOURSER) {
            // Leaving PRO_A_REMBOURSER auto-unlinks any reimbursement -- more forgiving than
            // rejecting the change, and the CHECK constraint requires it anyway.
            tx.setReimbursementId(null);
            tx.setReimbursementStatus(null);
        } else if (tx.getReimbursementStatus() == null) {
            tx.setReimbursementStatus(ReimbursementStatus.EN_ATTENTE);
        }
        tx.setProStatus(req.proStatus());

        transactionRepository.save(tx);
        return TransactionResponse.from(tx);
    }
}
