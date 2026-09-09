package com.picsou.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "expense_category")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExpenseCategory extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private FamilyMember member;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 7)
    @Builder.Default
    private String color = "#6366f1";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private CategoryType type = CategoryType.BOTH;

    /** Plain id, not a mapped relation -- same reasoning as {@link Transaction#getExpenseCategoryId()}.
     * A category whose own parentId is non-null may not itself be a parent (one level of
     * nesting only); enforced in ExpenseCategoryService since a self-referential FK can't
     * express "no grandparents" as a constraint. */
    private Long parentId;

    /** Optional, purely informational -- shown as progress on the pace card. Null means no
     * budget set; nothing enforces or blocks spending past it. */
    @Column(precision = 12, scale = 2)
    private BigDecimal monthlyBudget;
}
