package com.picsou.service;

import com.picsou.model.Category;
import com.picsou.model.CategoryKind;
import com.picsou.model.Transaction;
import com.picsou.service.budget.CategoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransferCategoryServiceTest {

    @Mock CategoryService categoryService;
    @InjectMocks TransferCategoryService service;

    private final Category transfer = Category.builder().id(1L).slug("virement-interne").name("Virement interne").kind(CategoryKind.TRANSFER).build();
    private final Category savings = Category.builder().id(2L).slug("epargne").name("Épargne").kind(CategoryKind.TRANSFER).build();
    private final Category groceries = Category.builder().id(3L).slug("courses").name("Courses").kind(CategoryKind.EXPENSE).build();

    private Transaction tx() {
        return Transaction.builder().date(LocalDate.of(2026, 1, 5)).amount(new BigDecimal("-100")).build();
    }

    @Test
    void filesAnUncategorizedTransactionUnderTheTransferCategory() {
        when(categoryService.findOrCreateDefault(10L, "virement-interne")).thenReturn(Optional.of(transfer));
        Transaction t = tx();

        service.fileAsTransfer(t, 10L);

        assertThat(t.getCategoryRef()).isSameAs(transfer);
        assertThat(t.isCategoryManual()).isTrue();
    }

    @Test
    void overridesAnExpenseCategory_aTransferIsNotAPurchase() {
        when(categoryService.findOrCreateDefault(10L, "virement-interne")).thenReturn(Optional.of(transfer));
        Transaction t = tx();
        t.setCategoryRef(groceries);
        t.setCategoryManual(true);

        service.fileAsTransfer(t, 10L);

        assertThat(t.getCategoryRef()).isSameAs(transfer);
    }

    @Test
    void keepsATransferCategoryTheMemberPickedByHand() {
        Transaction t = tx();
        t.setCategoryRef(savings);
        t.setCategoryManual(true);

        service.fileAsTransfer(t, 10L);

        assertThat(t.getCategoryRef()).isSameAs(savings);
        verifyNoInteractions(categoryService);
    }

    @Test
    void leavesTheTransactionAloneWhenTheMemberArchivedTheTransferCategory() {
        when(categoryService.findOrCreateDefault(10L, "virement-interne")).thenReturn(Optional.empty());
        Transaction t = tx();

        service.fileAsTransfer(t, 10L);

        assertThat(t.getCategoryRef()).isNull();
        assertThat(t.isCategoryManual()).isFalse();
    }

    @Test
    void releaseClearsOnlyTheGenericTransferCategory() {
        Transaction generic = tx();
        generic.setCategoryRef(transfer);
        generic.setCategoryManual(true);
        Transaction other = tx();
        other.setCategoryRef(savings);
        other.setCategoryManual(true);

        service.releaseFromTransfer(generic);
        service.releaseFromTransfer(other);

        assertThat(generic.getCategoryRef()).isNull();
        assertThat(generic.isCategoryManual()).isFalse();
        assertThat(other.getCategoryRef()).as("a category the member chose stays").isSameAs(savings);
    }
}
