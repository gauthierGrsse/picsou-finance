package com.picsou.service;

import com.picsou.dto.LinkExpensesRequest;
import com.picsou.dto.PendingReimbursementsResponse;
import com.picsou.dto.ReimbursementRequest;
import com.picsou.dto.ReimbursementResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.FamilyMember;
import com.picsou.model.ProStatus;
import com.picsou.model.Reimbursement;
import com.picsou.model.ReimbursementStatus;
import com.picsou.model.Transaction;
import com.picsou.repository.FamilyMemberRepository;
import com.picsou.repository.ReimbursementRepository;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReimbursementServiceTest {

    @Mock ReimbursementRepository reimbursementRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock FamilyMemberRepository familyMemberRepository;

    @InjectMocks ReimbursementService reimbursementService;

    private Account account() {
        return Account.builder().id(1L).name("Revolut").type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction expense(Long id, Account account, ProStatus proStatus, ReimbursementStatus status) {
        return Transaction.builder().id(id).account(account).date(LocalDate.of(2026, 1, 5))
            .description("Repas").amount(new BigDecimal("-25")).isManual(false)
            .nativeCurrency("EUR").proStatus(proStatus).reimbursementStatus(status).build();
    }

    private Transaction credit(Long id, Account account, BigDecimal amount) {
        return Transaction.builder().id(id).account(account).date(LocalDate.of(2026, 1, 10))
            .description("Note de frais").amount(amount).isManual(false)
            .nativeCurrency("EUR").proStatus(ProStatus.NON_CLASSE).build();
    }

    @Test
    void create_creditNotPositive_throws() {
        Account account = account();
        Transaction badCredit = credit(50L, account, new BigDecimal("-10"));

        when(transactionRepository.findByIdAndAccount_Member_Id(50L, 10L)).thenReturn(Optional.of(badCredit));

        assertThatThrownBy(() -> reimbursementService.create(
            new ReimbursementRequest(50L, List.of(1L)), 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("positive");

        verify(reimbursementRepository, never()).save(any());
    }

    @Test
    void create_creditAlreadyUsed_throws() {
        Account account = account();
        Transaction goodCredit = credit(50L, account, new BigDecimal("75"));

        when(transactionRepository.findByIdAndAccount_Member_Id(50L, 10L)).thenReturn(Optional.of(goodCredit));
        when(reimbursementRepository.existsByTransactionId(50L)).thenReturn(true);

        assertThatThrownBy(() -> reimbursementService.create(
            new ReimbursementRequest(50L, List.of(1L)), 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already used");
    }

    @Test
    void create_expenseNotProARembourser_throws() {
        Account account = account();
        Transaction goodCredit = credit(50L, account, new BigDecimal("75"));
        Transaction wrongExpense = expense(1L, account, ProStatus.PERSO, null);
        FamilyMember member = FamilyMember.builder().id(10L).build();

        when(transactionRepository.findByIdAndAccount_Member_Id(50L, 10L)).thenReturn(Optional.of(goodCredit));
        when(reimbursementRepository.existsByTransactionId(50L)).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(reimbursementRepository.save(any(Reimbursement.class))).thenAnswer(inv -> {
            Reimbursement r = inv.getArgument(0);
            r.setId(1L);
            return r;
        });
        when(transactionRepository.findByIdAndAccount_Member_Id(1L, 10L)).thenReturn(Optional.of(wrongExpense));

        assertThatThrownBy(() -> reimbursementService.create(
            new ReimbursementRequest(50L, List.of(1L)), 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("pro_a_rembourser");
    }

    @Test
    void create_expenseAlreadyLinked_throws() {
        Account account = account();
        Transaction goodCredit = credit(50L, account, new BigDecimal("75"));
        Transaction alreadyLinked = expense(1L, account, ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.REMBOURSE);
        alreadyLinked.setReimbursementId(77L);
        FamilyMember member = FamilyMember.builder().id(10L).build();

        when(transactionRepository.findByIdAndAccount_Member_Id(50L, 10L)).thenReturn(Optional.of(goodCredit));
        when(reimbursementRepository.existsByTransactionId(50L)).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(reimbursementRepository.save(any(Reimbursement.class))).thenAnswer(inv -> {
            Reimbursement r = inv.getArgument(0);
            r.setId(1L);
            return r;
        });
        when(transactionRepository.findByIdAndAccount_Member_Id(1L, 10L)).thenReturn(Optional.of(alreadyLinked));

        assertThatThrownBy(() -> reimbursementService.create(
            new ReimbursementRequest(50L, List.of(1L)), 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already linked");
    }

    @Test
    void create_validRequest_linksExpensesAndFlipsStatus() {
        Account account = account();
        Transaction goodCredit = credit(50L, account, new BigDecimal("75"));
        Transaction pendingExpense = expense(1L, account, ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.EN_ATTENTE);
        FamilyMember member = FamilyMember.builder().id(10L).build();

        when(transactionRepository.findByIdAndAccount_Member_Id(50L, 10L)).thenReturn(Optional.of(goodCredit));
        when(reimbursementRepository.existsByTransactionId(50L)).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(reimbursementRepository.save(any(Reimbursement.class))).thenAnswer(inv -> {
            Reimbursement r = inv.getArgument(0);
            r.setId(1L);
            return r;
        });
        when(transactionRepository.findByIdAndAccount_Member_Id(1L, 10L)).thenReturn(Optional.of(pendingExpense));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));
        when(transactionRepository.findByReimbursementId(1L)).thenReturn(List.of(pendingExpense));

        ReimbursementResponse result = reimbursementService.create(new ReimbursementRequest(50L, List.of(1L)), 10L);

        assertThat(pendingExpense.getReimbursementId()).isEqualTo(1L);
        assertThat(pendingExpense.getReimbursementStatus()).isEqualTo(ReimbursementStatus.REMBOURSE);
        assertThat(result.totalLinked()).isEqualByComparingTo("25");
    }

    @Test
    void delete_unflipsLinkedExpensesBeforeRemoving() {
        Account account = account();
        Reimbursement reimbursement = Reimbursement.builder().id(1L)
            .member(FamilyMember.builder().id(10L).build())
            .transaction(credit(50L, account, new BigDecimal("75")))
            .build();

        when(reimbursementRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(reimbursement));

        reimbursementService.delete(1L, 10L);

        // clearReimbursementLinks (the bulk EN_ATTENTE reset) must run before the row is deleted --
        // ON DELETE SET NULL alone would leave reimbursement_status stuck at REMBOURSE.
        InOrder order = inOrder(transactionRepository, reimbursementRepository);
        order.verify(transactionRepository).clearReimbursementLinks(1L);
        order.verify(reimbursementRepository).delete(reimbursement);
    }

    @Test
    void findPending_sumsAbsoluteAmounts() {
        Account account = account();
        Transaction e1 = expense(1L, account, ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.EN_ATTENTE);
        Transaction e2 = expense(2L, account, ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.EN_ATTENTE);
        e2.setAmount(new BigDecimal("-40"));

        when(transactionRepository.findByMemberAndProStatusAndReimbursementStatus(
            10L, ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.EN_ATTENTE))
            .thenReturn(List.of(e1, e2));

        PendingReimbursementsResponse result = reimbursementService.findPending(10L);

        assertThat(result.expenses()).hasSize(2);
        assertThat(result.totalOwed()).isEqualByComparingTo("65");
    }

    @Test
    void unlinkExpense_notLinkedToThisReimbursement_throws() {
        Reimbursement reimbursement = Reimbursement.builder().id(1L)
            .member(FamilyMember.builder().id(10L).build())
            .transaction(credit(50L, account(), new BigDecimal("75")))
            .build();
        Transaction expense = expense(1L, account(), ProStatus.PRO_A_REMBOURSER, ReimbursementStatus.REMBOURSE);
        expense.setReimbursementId(99L); // linked to a different reimbursement

        when(reimbursementRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(reimbursement));
        when(transactionRepository.findByIdAndAccount_Member_Id(1L, 10L)).thenReturn(Optional.of(expense));

        assertThatThrownBy(() -> reimbursementService.unlinkExpense(1L, 1L, 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("not linked");
    }
}
