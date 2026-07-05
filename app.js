(function () {
  "use strict";

  const STORAGE_KEY = "homecook.appData.v1";
  const UNITS = ["g", "ml", "pcs"];

  const state = loadState();

  const elements = {
    tabs: Array.from(document.querySelectorAll(".tab-button")),
    panels: {
      dishes: document.getElementById("dishes-panel"),
      basket: document.getElementById("basket-panel"),
    },
    totalPortions: document.getElementById("total-portions"),
    clearSelectionButton: document.getElementById("clear-selection-button"),
    basketClearSelectionButton: document.getElementById("basket-clear-selection-button"),
    importButton: document.getElementById("import-button"),
    exportButton: document.getElementById("export-button"),
    importFile: document.getElementById("import-file"),
    dishesGrid: document.getElementById("dishes-grid"),
    dishesEmpty: document.getElementById("dishes-empty"),
    basketList: document.getElementById("basket-list"),
    basketEmpty: document.getElementById("basket-empty"),
    addDishButton: document.getElementById("add-dish-button"),
    emptyAddDishButton: document.getElementById("empty-add-dish-button"),
    dialog: document.getElementById("dish-dialog"),
    dialogTitle: document.getElementById("dialog-title"),
    dialogModeLabel: document.getElementById("dialog-mode-label"),
    dialogCloseButton: document.getElementById("dialog-close-button"),
    dishForm: document.getElementById("dish-form"),
    dishId: document.getElementById("dish-id"),
    dishName: document.getElementById("dish-name"),
    dishDescription: document.getElementById("dish-description"),
    dishBasePortions: document.getElementById("dish-base-portions"),
    ingredientRows: document.getElementById("ingredient-rows"),
    ingredientOptions: document.getElementById("ingredient-options"),
    addIngredientRowButton: document.getElementById("add-ingredient-row-button"),
    cancelDishButton: document.getElementById("cancel-dish-button"),
    deleteDishButton: document.getElementById("delete-dish-button"),
    formError: document.getElementById("form-error"),
    toast: document.getElementById("toast"),
  };

  bindEvents();
  render();

  function bindEvents() {
    elements.tabs.forEach((button) => {
      button.addEventListener("click", () => setActiveTab(button.dataset.tab));
    });

    elements.addDishButton.addEventListener("click", () => openDishDialog());
    elements.emptyAddDishButton.addEventListener("click", () => openDishDialog());
    elements.dialogCloseButton.addEventListener("click", closeDishDialog);
    elements.cancelDishButton.addEventListener("click", closeDishDialog);
    elements.deleteDishButton.addEventListener("click", handleDialogDelete);
    elements.addIngredientRowButton.addEventListener("click", () => addIngredientRow());
    elements.dishForm.addEventListener("submit", handleDishFormSubmit);
    elements.clearSelectionButton.addEventListener("click", clearSelection);
    elements.basketClearSelectionButton.addEventListener("click", clearSelection);
    elements.exportButton.addEventListener("click", exportData);
    elements.importButton.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", importData);

    elements.dishesGrid.addEventListener("click", handleDishCardClick);
    elements.dishesGrid.addEventListener("input", handleDishPortionInput);
    elements.dishesGrid.addEventListener("change", handleDishPortionCommit);
    elements.ingredientRows.addEventListener("click", handleIngredientRowClick);

    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) {
        closeDishDialog();
      }
    });
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        return createEmptyState();
      }

      return normalizeImportedData(JSON.parse(saved));
    } catch (error) {
      console.warn("Could not load HomeCook data", error);
      return createEmptyState();
    }
  }

  function createEmptyState() {
    return {
      ingredients: [],
      dishes: [],
      selection: [],
    };
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function render() {
    renderIngredientOptions();
    renderHeader();
    renderDishes();
    renderBasket();
    persist();
  }

  function renderHeader() {
    const total = state.selection.reduce((sum, item) => sum + item.portions, 0);
    elements.totalPortions.textContent = formatSmartNumber(total);
    const hasSelection = total > 0;
    elements.clearSelectionButton.disabled = !hasSelection;
    elements.basketClearSelectionButton.disabled = !hasSelection;
  }

  function renderDishes() {
    elements.dishesGrid.innerHTML = "";
    elements.dishesEmpty.classList.toggle("is-visible", state.dishes.length === 0);

    const fragment = document.createDocumentFragment();
    state.dishes.forEach((dish) => {
      fragment.appendChild(createDishCard(dish));
    });
    elements.dishesGrid.appendChild(fragment);
  }

  function createDishCard(dish) {
    const selectedPortions = getSelectedPortions(dish.id);
    const card = document.createElement("article");
    card.className = selectedPortions > 0 ? "dish-card is-selected" : "dish-card";
    card.dataset.dishId = dish.id;

    const previewItems = dish.ingredients
      .slice(0, 4)
      .map((item) => {
        const ingredient = getIngredient(item.ingredientId);
        const name = ingredient ? ingredient.name : "Unknown ingredient";
        return `
          <li>
            <span>${escapeHtml(name)}</span>
            <strong>${formatSmartNumber(item.amount)} ${item.unit}</strong>
          </li>
        `;
      })
      .join("");

    const moreCount = Math.max(0, dish.ingredients.length - 4);
    const moreItem = moreCount > 0 ? `<li><span>${moreCount} more</span><strong></strong></li>` : "";

    card.innerHTML = `
      <div class="dish-card-header">
        <div>
          <h3>${escapeHtml(dish.name)}</h3>
          <p>${escapeHtml(dish.description || "No description")}</p>
        </div>
      </div>
      <div class="dish-meta">
        <span class="meta-chip">Recipe: ${formatSmartNumber(dish.basePortions)} portions</span>
        <span class="meta-chip">${dish.ingredients.length} ingredients</span>
      </div>
      <ul class="ingredients-preview">${previewItems}${moreItem}</ul>
      <div class="card-spacer"></div>
      <div class="card-controls" aria-label="Selected portions for ${escapeHtml(dish.name)}">
        <button class="step-button" type="button" data-action="decrement" aria-label="Decrease portions">-</button>
        <input class="portion-input" type="number" min="0" step="any" inputmode="decimal" value="${selectedPortions || 0}" aria-label="Portions" />
        <button class="step-button" type="button" data-action="increment" aria-label="Increase portions">+</button>
      </div>
    `;

    return card;
  }

  function renderBasket() {
    const basketItems = getBasketItems();
    elements.basketList.innerHTML = "";
    elements.basketEmpty.classList.toggle("is-visible", basketItems.length === 0);

    const fragment = document.createDocumentFragment();
    basketItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "basket-row";
      row.innerHTML = `
        <div class="basket-name">${escapeHtml(item.name)}</div>
        <div class="basket-amount">${formatSmartNumber(item.amount)} ${item.unit}</div>
      `;
      fragment.appendChild(row);
    });
    elements.basketList.appendChild(fragment);
  }

  function renderIngredientOptions() {
    elements.ingredientOptions.innerHTML = "";
    const fragment = document.createDocumentFragment();
    state.ingredients
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((ingredient) => {
        const option = document.createElement("option");
        option.value = ingredient.name;
        fragment.appendChild(option);
      });
    elements.ingredientOptions.appendChild(fragment);
  }

  function setActiveTab(tabName) {
    elements.tabs.forEach((button) => {
      const isActive = button.dataset.tab === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    Object.entries(elements.panels).forEach(([name, panel]) => {
      panel.classList.toggle("is-active", name === tabName);
    });
  }

  function openDishDialog(dishId) {
    const dish = dishId ? state.dishes.find((item) => item.id === dishId) : null;
    elements.formError.textContent = "";
    elements.dishForm.reset();
    elements.ingredientRows.innerHTML = "";
    elements.dishId.value = dish ? dish.id : "";
    elements.dialogTitle.textContent = dish ? "Edit dish" : "Add dish";
    elements.dialogModeLabel.textContent = dish ? "Existing dish" : "New dish";
    elements.deleteDishButton.hidden = !dish;

    if (dish) {
      elements.dishName.value = dish.name;
      elements.dishDescription.value = dish.description;
      elements.dishBasePortions.value = dish.basePortions;
      dish.ingredients.forEach((item) => addIngredientRow(item));
    } else {
      elements.dishBasePortions.value = 1;
      addIngredientRow();
    }

    if (typeof elements.dialog.showModal === "function") {
      elements.dialog.showModal();
    } else {
      elements.dialog.setAttribute("open", "");
    }

    window.setTimeout(() => elements.dishName.focus(), 0);
  }

  function closeDishDialog() {
    elements.dialog.close();
  }

  function addIngredientRow(item) {
    const ingredient = item ? getIngredient(item.ingredientId) : null;
    const row = document.createElement("div");
    row.className = "ingredient-row";
    row.innerHTML = `
      <input class="ingredient-name" type="text" list="ingredient-options" placeholder="Ingredient" value="${escapeHtml(
        ingredient ? ingredient.name : ""
      )}" required maxlength="80" />
      <input class="ingredient-amount" type="number" min="0" step="1" placeholder="Amount" value="${
        item ? item.amount : ""
      }" required />
      <select class="ingredient-unit" required>
        ${UNITS.map((unit) => `<option value="${unit}" ${item && item.unit === unit ? "selected" : ""}>${unit}</option>`).join("")}
      </select>
      <button class="icon-button remove-row-button" type="button" data-action="remove-ingredient" aria-label="Remove ingredient">x</button>
    `;
    elements.ingredientRows.appendChild(row);
  }

  function handleIngredientRowClick(event) {
    const removeButton = event.target.closest('[data-action="remove-ingredient"]');
    if (!removeButton) {
      return;
    }

    const row = removeButton.closest(".ingredient-row");
    if (elements.ingredientRows.children.length === 1) {
      row.querySelector(".ingredient-name").value = "";
      row.querySelector(".ingredient-amount").value = "";
      row.querySelector(".ingredient-unit").value = "g";
      return;
    }

    row.remove();
  }

  function handleDishFormSubmit(event) {
    event.preventDefault();
    const result = readDishForm();
    if (!result.ok) {
      elements.formError.textContent = result.error;
      return;
    }

    const existingDishId = elements.dishId.value;
    if (existingDishId) {
      const dish = state.dishes.find((item) => item.id === existingDishId);
      if (!dish) {
        elements.formError.textContent = "This dish no longer exists.";
        return;
      }

      dish.name = result.dish.name;
      dish.description = result.dish.description;
      dish.basePortions = result.dish.basePortions;
      dish.ingredients = result.dish.ingredients;
      showToast("Dish updated");
    } else {
      state.dishes.push({
        id: createId("dish"),
        ...result.dish,
      });
      showToast("Dish added");
    }

    pruneUnusedIngredients();
    closeDishDialog();
    render();
  }

  function readDishForm() {
    const name = normalizeDisplayName(elements.dishName.value);
    const description = elements.dishDescription.value.trim();
    const basePortions = parsePositiveNumber(elements.dishBasePortions.value);

    if (!name) {
      return { ok: false, error: "Add a dish name." };
    }

    if (!basePortions) {
      return { ok: false, error: "Recipe portions must be greater than zero." };
    }

    const rows = Array.from(elements.ingredientRows.querySelectorAll(".ingredient-row"));
    const draftIngredients = [];

    for (const row of rows) {
      const ingredientName = normalizeDisplayName(row.querySelector(".ingredient-name").value);
      const amount = parsePositiveNumber(row.querySelector(".ingredient-amount").value);
      const unit = row.querySelector(".ingredient-unit").value;

      if (!ingredientName && !amount) {
        continue;
      }

      if (!ingredientName) {
        return { ok: false, error: "Each ingredient needs a name." };
      }

      if (!amount) {
        return { ok: false, error: `Add an amount for ${ingredientName}.` };
      }

      if (!UNITS.includes(unit)) {
        return { ok: false, error: "Use g, ml, or pcs as the unit." };
      }

      draftIngredients.push({
        ingredientName,
        amount,
        unit,
      });
    }

    if (draftIngredients.length === 0) {
      return { ok: false, error: "Add at least one ingredient." };
    }

    const dishIngredients = draftIngredients.map((item) => {
      const ingredient = ensureIngredient(item.ingredientName);
      return {
        ingredientId: ingredient.id,
        amount: item.amount,
        unit: item.unit,
      };
    });

    return {
      ok: true,
      dish: {
        name,
        description,
        basePortions,
        ingredients: combineDuplicateDishIngredients(dishIngredients),
      },
    };
  }

  function combineDuplicateDishIngredients(items) {
    const byKey = new Map();
    items.forEach((item) => {
      const key = `${item.ingredientId}|${item.unit}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.amount += item.amount;
      } else {
        byKey.set(key, { ...item });
      }
    });
    return Array.from(byKey.values());
  }

  function handleDishCardClick(event) {
    const card = event.target.closest(".dish-card");
    if (!card) {
      return;
    }

    const dishId = card.dataset.dishId;
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      if (event.target.closest(".card-controls")) {
        return;
      }

      openDishDialog(dishId);
      return;
    }

    const action = actionButton.dataset.action;

    if (action === "increment") {
      setSelectedPortions(dishId, getSelectedPortions(dishId) + 1);
    }

    if (action === "decrement") {
      setSelectedPortions(dishId, Math.max(0, getSelectedPortions(dishId) - 1));
    }

    render();
  }

  function handleDishPortionInput(event) {
    if (!event.target.classList.contains("portion-input")) {
      return;
    }

    const card = event.target.closest(".dish-card");
    const value = parseNonNegativeNumber(event.target.value);
    setSelectedPortions(card.dataset.dishId, value || 0);
    card.classList.toggle("is-selected", value > 0);
    renderHeader();
    renderBasket();
    persist();
  }

  function handleDishPortionCommit(event) {
    if (!event.target.classList.contains("portion-input")) {
      return;
    }

    const card = event.target.closest(".dish-card");
    event.target.value = getSelectedPortions(card.dataset.dishId) || 0;
  }

  function handleDialogDelete() {
    const dishId = elements.dishId.value;
    if (!dishId) {
      return;
    }

    const deleted = deleteDish(dishId);
    if (deleted) {
      closeDishDialog();
    }
  }

  function deleteDish(dishId) {
    const dish = state.dishes.find((item) => item.id === dishId);
    if (!dish) {
      return false;
    }

    const shouldDelete = window.confirm(`Delete "${dish.name}"?`);
    if (!shouldDelete) {
      return false;
    }

    state.dishes = state.dishes.filter((item) => item.id !== dishId);
    state.selection = state.selection.filter((item) => item.dishId !== dishId);
    pruneUnusedIngredients();
    showToast("Dish deleted");
    render();
    return true;
  }

  function clearSelection() {
    if (state.selection.length === 0) {
      return;
    }

    state.selection = [];
    showToast("Selection cleared");
    render();
  }

  function getSelectedPortions(dishId) {
    const selection = state.selection.find((item) => item.dishId === dishId);
    return selection ? selection.portions : 0;
  }

  function setSelectedPortions(dishId, portions) {
    const normalizedPortions = Math.max(0, Number(portions) || 0);
    const existing = state.selection.find((item) => item.dishId === dishId);

    if (normalizedPortions === 0) {
      state.selection = state.selection.filter((item) => item.dishId !== dishId);
      return;
    }

    if (existing) {
      existing.portions = normalizedPortions;
    } else {
      state.selection.push({ dishId, portions: normalizedPortions });
    }
  }

  function getBasketItems() {
    const byKey = new Map();

    state.selection.forEach((selection) => {
      const dish = state.dishes.find((item) => item.id === selection.dishId);
      if (!dish || dish.basePortions <= 0 || selection.portions <= 0) {
        return;
      }

      dish.ingredients.forEach((item) => {
        const ingredient = getIngredient(item.ingredientId);
        if (!ingredient) {
          return;
        }

        const amount = (item.amount / dish.basePortions) * selection.portions;
        const key = `${item.ingredientId}|${item.unit}`;
        const existing = byKey.get(key);

        if (existing) {
          existing.amount += amount;
        } else {
          byKey.set(key, {
            ingredientId: item.ingredientId,
            name: ingredient.name,
            amount,
            unit: item.unit,
          });
        }
      });
    });

    return Array.from(byKey.values()).sort((left, right) => {
      const nameSort = left.name.localeCompare(right.name);
      return nameSort || left.unit.localeCompare(right.unit);
    });
  }

  function getIngredient(ingredientId) {
    return state.ingredients.find((item) => item.id === ingredientId);
  }

  function ensureIngredient(name) {
    const normalizedName = normalizeName(name);
    const existing = state.ingredients.find((item) => normalizeName(item.name) === normalizedName);

    if (existing) {
      return existing;
    }

    const ingredient = {
      id: createId("ingredient"),
      name,
    };
    state.ingredients.push(ingredient);
    return ingredient;
  }

  function pruneUnusedIngredients() {
    const usedIds = new Set();
    state.dishes.forEach((dish) => {
      dish.ingredients.forEach((item) => usedIds.add(item.ingredientId));
    });
    state.ingredients = state.ingredients.filter((ingredient) => usedIds.has(ingredient.id));
  }

  function exportData() {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homecook-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Data exported");
  }

  function importData(event) {
    const file = event.target.files[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const nextState = normalizeImportedData(JSON.parse(reader.result));
        const shouldReplace =
          state.dishes.length === 0 ||
          window.confirm("Importing this file will replace current HomeCook data. Continue?");

        if (!shouldReplace) {
          return;
        }

        state.ingredients = nextState.ingredients;
        state.dishes = nextState.dishes;
        state.selection = nextState.selection;
        showToast("Data imported");
        render();
      } catch (error) {
        console.error("Import failed", error);
        showToast("Could not import that JSON file");
      }
    });
    reader.readAsText(file);
  }

  function normalizeImportedData(input) {
    const nextState = createEmptyState();
    const ingredientIdMap = new Map();
    const ingredientNameMap = new Map();

    if (!input || typeof input !== "object") {
      return nextState;
    }

    const sourceIngredients = Array.isArray(input.ingredients) ? input.ingredients : [];
    sourceIngredients.forEach((ingredient) => {
      if (!ingredient || typeof ingredient !== "object") {
        return;
      }

      const name = normalizeDisplayName(ingredient.name);
      if (!name) {
        return;
      }

      const normalizedName = normalizeName(name);
      let targetIngredient = ingredientNameMap.get(normalizedName);
      if (!targetIngredient) {
        targetIngredient = {
          id: createImportedId(ingredient.id, "ingredient"),
          name,
        };
        ingredientNameMap.set(normalizedName, targetIngredient);
        nextState.ingredients.push(targetIngredient);
      }

      if (ingredient.id) {
        ingredientIdMap.set(String(ingredient.id), targetIngredient.id);
      }
    });

    const sourceDishes = Array.isArray(input.dishes) ? input.dishes : [];
    sourceDishes.forEach((dish) => {
      if (!dish || typeof dish !== "object") {
        return;
      }

      const name = normalizeDisplayName(dish.name);
      const basePortions = parsePositiveNumber(dish.basePortions);
      if (!name || !basePortions) {
        return;
      }

      const ingredients = [];
      const sourceDishIngredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
      sourceDishIngredients.forEach((item) => {
        if (!item || typeof item !== "object") {
          return;
        }

        const amount = parsePositiveNumber(item.amount);
        const unit = item.unit;
        if (!amount || !UNITS.includes(unit)) {
          return;
        }

        let ingredientId = ingredientIdMap.get(String(item.ingredientId));
        if (!ingredientId && item.name) {
          const ingredient = ensureImportedIngredient(nextState, ingredientNameMap, item.name);
          ingredientId = ingredient.id;
        }

        if (!ingredientId) {
          return;
        }

        ingredients.push({ ingredientId, amount, unit });
      });

      if (ingredients.length === 0) {
        return;
      }

      nextState.dishes.push({
        id: createImportedId(dish.id, "dish"),
        name,
        description: typeof dish.description === "string" ? dish.description.trim() : "",
        basePortions,
        ingredients: combineImportedDishIngredients(ingredients),
      });
    });

    const validDishIds = new Set(nextState.dishes.map((dish) => dish.id));
    const sourceSelection = Array.isArray(input.selection) ? input.selection : [];
    sourceSelection.forEach((selection) => {
      if (!selection || typeof selection !== "object") {
        return;
      }

      const dishId = String(selection.dishId);
      const portions = parseNonNegativeNumber(selection.portions);
      if (validDishIds.has(dishId) && portions > 0) {
        nextState.selection.push({ dishId, portions });
      }
    });

    pruneUnusedIngredientsFor(nextState);
    return nextState;
  }

  function ensureImportedIngredient(nextState, ingredientNameMap, name) {
    const displayName = normalizeDisplayName(name);
    const normalizedName = normalizeName(displayName);
    let ingredient = ingredientNameMap.get(normalizedName);
    if (!ingredient) {
      ingredient = {
        id: createId("ingredient"),
        name: displayName,
      };
      ingredientNameMap.set(normalizedName, ingredient);
      nextState.ingredients.push(ingredient);
    }
    return ingredient;
  }

  function combineImportedDishIngredients(items) {
    const byKey = new Map();
    items.forEach((item) => {
      const key = `${item.ingredientId}|${item.unit}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.amount += item.amount;
      } else {
        byKey.set(key, { ...item });
      }
    });
    return Array.from(byKey.values());
  }

  function pruneUnusedIngredientsFor(nextState) {
    const usedIds = new Set();
    nextState.dishes.forEach((dish) => {
      dish.ingredients.forEach((item) => usedIds.add(item.ingredientId));
    });
    nextState.ingredients = nextState.ingredients.filter((ingredient) => usedIds.has(ingredient.id));
  }

  function normalizeDisplayName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeName(value) {
    return normalizeDisplayName(value).toLocaleLowerCase();
  }

  function parsePositiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function parseNonNegativeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function formatSmartNumber(value) {
    const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(rounded);
  }

  function createImportedId(value, prefix) {
    const id = normalizeDisplayName(value);
    return id || createId(prefix);
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 2400);
  }
})();
