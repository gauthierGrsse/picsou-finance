package com.picsou.service;

import com.picsou.dto.TransactionResponse;
import com.picsou.model.Account;
import com.picsou.model.AccountType;
import com.picsou.model.Transaction;
import com.picsou.repository.TransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionQueryServiceTest {

    @Mock TransactionRepository transactionRepository;

    @InjectMocks TransactionQueryService transactionQueryService;

    private Account account(Long id, String name) {
        return Account.builder().id(id).name(name).type(AccountType.CHECKING)
            .currency("EUR").currentBalance(BigDecimal.ZERO).isManual(false).build();
    }

    private Transaction tx(Long id, Account account, LocalDate date, BigDecimal amount) {
        return Transaction.builder().id(id).account(account).date(date)
            .description("tx " + id).amount(amount).isManual(false).nativeCurrency("EUR").build();
    }

    @Test
    void findAll_ordersByDateDescendingThenIdDescending() {
        Account acc = account(1L, "Compte Courant");
        Transaction older = tx(1L, acc, LocalDate.of(2026, 1, 5), new BigDecimal("-10"));
        Transaction newer = tx(2L, acc, LocalDate.of(2026, 1, 20), new BigDecimal("-20"));
        Transaction sameDaySecond = tx(3L, acc, LocalDate.of(2026, 1, 20), new BigDecimal("-30"));

        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)))
            .thenReturn(List.of(older, newer, sameDaySecond));

        List<TransactionResponse> result = transactionQueryService.findAll(10L, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

        assertThat(result).extracting(TransactionResponse::id).containsExactly(3L, 2L, 1L);
    }

    @Test
    void findAll_includesAccountIdAndName() {
        Account acc = account(5L, "Livret A");
        Transaction transaction = tx(1L, acc, LocalDate.of(2026, 1, 5), new BigDecimal("-10"));

        when(transactionRepository.findByAccount_Member_IdAndDateBetween(10L, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31)))
            .thenReturn(List.of(transaction));

        List<TransactionResponse> result = transactionQueryService.findAll(10L, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 31));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).accountId()).isEqualTo(5L);
        assertThat(result.get(0).accountName()).isEqualTo("Livret A");
    }
}
