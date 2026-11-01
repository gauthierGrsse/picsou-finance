package com.picsou.service;

import com.picsou.model.Category;
import com.picsou.model.CategoryKind;
import com.picsou.model.Transaction;
import com.picsou.service.budget.CategoryService;
import org.springframework.stereotype.Service;

/**
 * Keeps a transaction's category in step with its internal-transfer status.
 *
 * <p>A transaction marked as an internal transfer is money moving between the member's own
 * accounts, not spending or income. The budget pages already leave TRANSFER-kind categories out
 * of cash flow, so filing the transaction under the member's "Virement interne" category is what
 * makes them agree with the expense dashboard (which excludes it through its status). Both
 * directions are needed: unlinking a transfer must not leave it filed as one.
 */
@Service
public class TransferCategoryService {

    static final String TRANSFER_SLUG = "virement-interne";

    private final CategoryService categoryService;

    public TransferCategoryService(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    /**
     * Files {@code t} under "Virement interne". A TRANSFER category the member picked by hand
     * (savings, investment) is kept -- it says more than the generic one and is excluded from
     * cash flow just the same. If the member archived "Virement interne" the transaction is left
     * as it was.
     */
    public void fileAsTransfer(Transaction t, Long memberId) {
        Category current = t.getCategoryRef();
        if (current != null && t.isCategoryManual() && current.getKind() == CategoryKind.TRANSFER) {
            return;
        }
        categoryService.findOrCreateDefault(memberId, TRANSFER_SLUG).ifPresent(category -> {
            t.setCategoryRef(category);
            t.setCategoryManual(true);
        });
    }

    /** Clears the category only if it is the generic "Virement interne" one; any other stays. */
    public void releaseFromTransfer(Transaction t) {
        Category current = t.getCategoryRef();
        if (current != null && TRANSFER_SLUG.equals(current.getSlug())) {
            t.setCategoryRef(null);
            t.setCategoryManual(false);
        }
    }
}
