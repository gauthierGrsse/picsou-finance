package com.picsou.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

/** "If the description contains {@code pattern}, classify it as {@code expenseCategoryId}
 * (and optionally set {@code proStatus})." Applied by {@code CategoryRuleService} to newly
 * synced transactions and, on create/update, retroactively to existing uncategorized ones --
 * never to a transaction that already has a category or an explicitly-set status. */
@Entity
@Table(name = "category_rule")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryRule extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private FamilyMember member;

    @Column(nullable = false, length = 200)
    private String pattern;

    /** Plain id, not a mapped relation -- same reasoning as {@link Transaction#getExpenseCategoryId()}. */
    @Column(nullable = false)
    private Long expenseCategoryId;

    /** Null means "leave the status alone, only set the category" -- the common case: the
     * user said they don't expect to use this by default, but the field exists for when
     * they do. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ProStatus proStatus;
}
