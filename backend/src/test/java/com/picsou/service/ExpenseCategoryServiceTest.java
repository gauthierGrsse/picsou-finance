package com.picsou.service;

import com.picsou.dto.ExpenseCategoryRequest;
import com.picsou.dto.ExpenseCategoryResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.CategoryType;
import com.picsou.model.ExpenseCategory;
import com.picsou.model.FamilyMember;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseCategoryServiceTest {

    @Mock ExpenseCategoryRepository expenseCategoryRepository;
    @Mock FamilyMemberRepository familyMemberRepository;

    @InjectMocks ExpenseCategoryService expenseCategoryService;

    private ExpenseCategory category(Long id, String name) {
        return ExpenseCategory.builder().id(id).name(name).color("#6366f1").build();
    }

    @Test
    void findAll_memberWithNoCategories_seedsTheNineDefaults() {
        FamilyMember member = FamilyMember.builder().id(10L).build();
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L)).thenReturn(List.of());
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(expenseCategoryRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        List<ExpenseCategoryResponse> result = expenseCategoryService.findAll(10L);

        assertThat(result).hasSize(9);
        assertThat(result).extracting(ExpenseCategoryResponse::name)
            .contains("Restauration", "Courses", "Abonnements", "Transport", "Logement",
                "Santé", "Loisirs", "Matériel/Équipement", "Autre");
    }

    @Test
    void findAll_memberWithExistingCategories_doesNotReseed() {
        when(expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(10L))
            .thenReturn(List.of(category(1L, "Restauration")));

        List<ExpenseCategoryResponse> result = expenseCategoryService.findAll(10L);

        assertThat(result).hasSize(1);
        verify(expenseCategoryRepository, never()).saveAll(any());
        verify(familyMemberRepository, never()).getReferenceById(any());
    }

    @Test
    void create_duplicateNameForMember_throws() {
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Restauration")).thenReturn(true);

        assertThatThrownBy(() ->
            expenseCategoryService.create(new ExpenseCategoryRequest("Restauration", "#ffffff", CategoryType.BOTH, null, null), 10L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Restauration");

        verify(expenseCategoryRepository, never()).save(any());
    }

    @Test
    void create_newName_savesWithMemberAndColor() {
        FamilyMember member = FamilyMember.builder().id(10L).build();
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Vacances")).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(expenseCategoryRepository.save(any(ExpenseCategory.class))).thenAnswer(inv -> {
            ExpenseCategory c = inv.getArgument(0);
            c.setId(42L);
            return c;
        });

        ExpenseCategoryResponse result = expenseCategoryService.create(new ExpenseCategoryRequest("Vacances", "#00ff00", CategoryType.INCOME, null, null), 10L);

        assertThat(result.id()).isEqualTo(42L);
        assertThat(result.name()).isEqualTo("Vacances");
        assertThat(result.color()).isEqualTo("#00ff00");
        assertThat(result.type()).isEqualTo(CategoryType.INCOME);

        ArgumentCaptor<ExpenseCategory> captor = ArgumentCaptor.forClass(ExpenseCategory.class);
        verify(expenseCategoryRepository).save(captor.capture());
        assertThat(captor.getValue().getMember()).isSameAs(member);
    }

    @Test
    void create_withMonthlyBudget_carriesItThrough() {
        FamilyMember member = FamilyMember.builder().id(10L).build();
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Restauration")).thenReturn(false);
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(expenseCategoryRepository.save(any(ExpenseCategory.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpenseCategoryResponse result = expenseCategoryService.create(
            new ExpenseCategoryRequest("Restauration", "#00ff00", CategoryType.EXPENSE, null, new BigDecimal("150.00")), 10L);

        assertThat(result.monthlyBudget()).isEqualByComparingTo("150.00");
    }

    @Test
    void delete_wrongMember_throwsNotFound() {
        when(expenseCategoryRepository.findByIdAndMemberId(5L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> expenseCategoryService.delete(5L, 10L))
            .isInstanceOf(ResourceNotFoundException.class);

        verify(expenseCategoryRepository, never()).delete(any());
    }

    // ─── parent/subcategory validation ─────────────────────────────────────

    @Test
    void create_withValidTopLevelParent_setsParentId() {
        FamilyMember member = FamilyMember.builder().id(10L).build();
        ExpenseCategory parent = category(1L, "Alimentation");
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Courses")).thenReturn(false);
        when(expenseCategoryRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(parent));
        when(familyMemberRepository.getReferenceById(10L)).thenReturn(member);
        when(expenseCategoryRepository.save(any(ExpenseCategory.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpenseCategoryResponse result = expenseCategoryService.create(new ExpenseCategoryRequest("Courses", "#00ff00", CategoryType.EXPENSE, 1L, null), 10L);

        assertThat(result.parentId()).isEqualTo(1L);
    }

    @Test
    void create_parentBelongingToAnotherMember_throwsNotFound() {
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Courses")).thenReturn(false);
        when(expenseCategoryRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            expenseCategoryService.create(new ExpenseCategoryRequest("Courses", "#00ff00", CategoryType.EXPENSE, 1L, null), 10L))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void create_parentThatIsItselfASubcategory_rejectsTwoLevelsOfNesting() {
        ExpenseCategory grandparent = category(1L, "Alimentation");
        ExpenseCategory parent = ExpenseCategory.builder().id(2L).name("Courses").color("#6366f1").parentId(1L).build();
        when(expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(10L, "Bio")).thenReturn(false);
        when(expenseCategoryRepository.findByIdAndMemberId(2L, 10L)).thenReturn(Optional.of(parent));

        assertThatThrownBy(() ->
            expenseCategoryService.create(new ExpenseCategoryRequest("Bio", "#00ff00", CategoryType.EXPENSE, 2L, null), 10L))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void update_settingCategoryAsItsOwnParent_throws() {
        ExpenseCategory existing = category(1L, "Restauration");
        when(expenseCategoryRepository.findByIdAndMemberId(1L, 10L)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() ->
            expenseCategoryService.update(1L, new ExpenseCategoryRequest("Restauration", "#00ff00", CategoryType.EXPENSE, 1L, null), 10L))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
