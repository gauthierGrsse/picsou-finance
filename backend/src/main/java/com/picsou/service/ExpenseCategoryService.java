package com.picsou.service;

import com.picsou.dto.ExpenseCategoryRequest;
import com.picsou.dto.ExpenseCategoryResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.ExpenseCategory;
import com.picsou.repository.ExpenseCategoryRepository;
import com.picsou.repository.FamilyMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ExpenseCategoryService {

    /** Name + default hex color, in display order. Colors drawn from the palette already used
     * for account defaults, for visual consistency across the app. */
    private static final String[][] STARTER_CATEGORIES = {
        {"Restauration", "#f97316"},
        {"Courses", "#22c55e"},
        {"Abonnements", "#a855f7"},
        {"Transport", "#3b82f6"},
        {"Logement", "#6366f1"},
        {"Santé", "#ef4444"},
        {"Loisirs", "#ec4899"},
        {"Matériel/Équipement", "#14b8a6"},
        {"Autre", "#71717a"},
    };

    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final FamilyMemberRepository familyMemberRepository;

    public ExpenseCategoryService(
        ExpenseCategoryRepository expenseCategoryRepository,
        FamilyMemberRepository familyMemberRepository
    ) {
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.familyMemberRepository = familyMemberRepository;
    }

    /** Lazily seeds the starter categories on first call for a member -- simpler and more
     * robust than hooking every FamilyMember-creation code path, and self-heals for members
     * that predate this feature. */
    @Transactional
    public List<ExpenseCategoryResponse> findAll(Long memberId) {
        List<ExpenseCategory> existing = expenseCategoryRepository.findAllByMemberIdOrderByNameAsc(memberId);
        if (existing.isEmpty()) {
            existing = seedDefaults(memberId);
        }
        return existing.stream().map(ExpenseCategoryResponse::from).toList();
    }

    @Transactional
    public ExpenseCategoryResponse create(ExpenseCategoryRequest req, Long memberId) {
        if (expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(memberId, req.name())) {
            throw new IllegalArgumentException("A category named '" + req.name() + "' already exists");
        }
        ExpenseCategory category = ExpenseCategory.builder()
            .member(familyMemberRepository.getReferenceById(memberId))
            .name(req.name())
            .color(req.color() != null ? req.color() : "#6366f1")
            .build();
        return ExpenseCategoryResponse.from(expenseCategoryRepository.save(category));
    }

    @Transactional
    public ExpenseCategoryResponse update(Long id, ExpenseCategoryRequest req, Long memberId) {
        ExpenseCategory category = getOrThrow(id, memberId);
        if (!category.getName().equalsIgnoreCase(req.name())
            && expenseCategoryRepository.existsByMemberIdAndNameIgnoreCase(memberId, req.name())) {
            throw new IllegalArgumentException("A category named '" + req.name() + "' already exists");
        }
        category.setName(req.name());
        if (req.color() != null) {
            category.setColor(req.color());
        }
        return ExpenseCategoryResponse.from(expenseCategoryRepository.save(category));
    }

    @Transactional
    public void delete(Long id, Long memberId) {
        ExpenseCategory category = getOrThrow(id, memberId);
        expenseCategoryRepository.delete(category);
    }

    private List<ExpenseCategory> seedDefaults(Long memberId) {
        var member = familyMemberRepository.getReferenceById(memberId);
        List<ExpenseCategory> seeded = List.of(STARTER_CATEGORIES).stream()
            .map(entry -> ExpenseCategory.builder().member(member).name(entry[0]).color(entry[1]).build())
            .toList();
        return expenseCategoryRepository.saveAll(seeded);
    }

    private ExpenseCategory getOrThrow(Long id, Long memberId) {
        return expenseCategoryRepository.findByIdAndMemberId(id, memberId)
            .orElseThrow(() -> ResourceNotFoundException.expenseCategory(id));
    }
}
