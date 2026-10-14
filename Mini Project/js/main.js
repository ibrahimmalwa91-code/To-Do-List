(() => {
  "use strict";

  const STORAGE_KEY = "yomi-tasks-v1";
  const THEME_KEY = "yomi-theme";
  const $ = (selector) => document.querySelector(selector);

  const form = $("#taskForm");
  const taskInput = $("#taskInput");
  const taskPriority = $("#taskPriority");
  const taskDate = $("#taskDate");
  const taskList = $("#taskList");
  const emptyState = $("#emptyState");
  const searchInput = $("#searchInput");
  const clearSearch = $("#clearSearch");
  const editDialog = $("#editDialog");
  const editForm = $("#editForm");
  const editTaskInput = $("#editTaskInput");
  const editPriority = $("#editPriority");
  const editDate = $("#editDate");
  const toast = $("#toast");

  let tasks = loadTasks();
  let currentFilter = "all";
  let editingId = null;
  let toastTimer = null;

  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  function loadTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter((task) => task && typeof task.title === "string") : [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      showToast("تعذر حفظ البيانات في المتصفح. جرّب مساحة تخزين متاحة.");
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(date);
  }

  function isOverdue(task) {
    return Boolean(task.dueDate && task.dueDate < todayISO() && !task.completed);
  }

  function priorityMarkup(priority) {
    const map = {
      urgent: ["عاجلة", "fa-solid fa-fire-flame-curved", "priority-urgent"],
      high: ["مهمة", "fa-solid fa-flag", "priority-high"],
      normal: ["عادية", "fa-solid fa-leaf", "priority-normal"]
    };
    const [label, icon, className] = map[priority] || map.normal;
    return `<span class="priority-pill ${className}"><i class="${icon}"></i>${label}</span>`;
  }

  function filteredTasks() {
    const query = searchInput.value.trim().toLocaleLowerCase("ar");
    return tasks.filter((task) => {
      const matchesQuery = task.title.toLocaleLowerCase("ar").includes(query);
      const matchesFilter =
        currentFilter === "all" ||
        (currentFilter === "active" && !task.completed) ||
        (currentFilter === "completed" && task.completed) ||
        (currentFilter === "today" && task.dueDate === todayISO());
      return matchesQuery && matchesFilter;
    }).sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      const priorityOrder = { urgent: 0, high: 1, normal: 2 };
      const priorityDifference = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (priorityDifference) return priorityDifference;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  function taskMarkup(task) {
    const overdue = isOverdue(task);
    const dateMarkup = task.dueDate
      ? `<span class="${overdue ? "overdue" : ""}"><i class="fa-regular fa-calendar"></i>${overdue ? "فات موعدها" : formatDate(task.dueDate)}</span>`
      : "";
    const completedMarkup = task.completed
      ? `<span><i class="fa-solid fa-check"></i> خلصت</span>`
      : "";
    return `
      <article class="task-item ${task.completed ? "is-completed" : ""}" data-id="${escapeHTML(task.id)}">
        <button class="task-check" type="button" data-action="toggle" aria-label="${task.completed ? "إعادة فتح المهمة" : "إكمال المهمة"}" aria-pressed="${Boolean(task.completed)}">
          ${task.completed ? '<i class="fa-solid fa-check"></i>' : ""}
        </button>
        <div class="task-body">
          <div class="task-title-row">
            <h3 class="task-title">${escapeHTML(task.title)}</h3>
            ${priorityMarkup(task.priority)}
          </div>
          <div class="task-meta">
            ${dateMarkup}
            ${completedMarkup}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action" type="button" data-action="edit" aria-label="تعديل المهمة" title="تعديل"><i class="fa-solid fa-pen"></i></button>
          <button class="task-action delete" type="button" data-action="delete" aria-label="حذف المهمة" title="حذف"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </article>`;
  }

  function render() {
    const shown = filteredTasks();
    taskList.innerHTML = shown.map(taskMarkup).join("");
    taskList.hidden = shown.length === 0;
    emptyState.classList.toggle("show", shown.length === 0);
    $("#visibleCount").textContent = shown.length;
    $("#emptyTitle").textContent = tasks.length === 0 ? "لسه مفيش مهام هنا" : "مفيش نتائج مطابقة";
    $("#emptyText").textContent = tasks.length === 0
      ? "ابدأ بإضافة أول مهمة، وخلي يومك أخف وأسهل."
      : "جرّب تغيّر الفلتر أو كلمة البحث.";
    $("#allCount").textContent = tasks.length;
    $("#activeCount").textContent = tasks.filter((task) => !task.completed).length;
    $("#completedCount").textContent = tasks.filter((task) => task.completed).length;
    $("#clearCompleted").disabled = !tasks.some((task) => task.completed);
    clearSearch.hidden = !searchInput.value;
    updateProgress();
  }

  function updateProgress() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const remaining = total - completed;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    $("#heroTotal").textContent = total;
    $("#heroCompleted").textContent = completed;
    $("#heroRemaining").textContent = remaining;
    $("#progressPercent").textContent = `${percent}%`;
    $("#progressRing").style.setProperty("--progress", `${percent}%`);
    $("#progressRing").setAttribute("aria-label", `نسبة الإنجاز ${percent} بالمئة`);
    $("#progressBar").style.width = `${percent}%`;
    $("#progressMessage").textContent = total === 0
      ? "البداية دايمًا بخطوة ✨"
      : percent === 100
        ? "عاش! خلصت كل اللي عليك 🎉"
        : percent >= 60
          ? "أنت قربت تخلص، كمّل! 💪"
          : "كل خطوة صغيرة بتفرق 🌱";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function addTask(title, priority, dueDate) {
    tasks.unshift({
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: title.trim(),
      priority,
      dueDate,
      completed: false,
      createdAt: Date.now()
    });
    saveTasks();
    currentFilter = "all";
    document.querySelectorAll(".filter-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.filter === "all");
    });
    searchInput.value = "";
    render();
    showToast("اتضافت المهمة بنجاح 🌿");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = taskInput.value.trim();
    if (!title) {
      taskInput.focus();
      showToast("اكتب اسم المهمة الأول.");
      return;
    }
    addTask(title, taskPriority.value, taskDate.value);
    form.reset();
    taskInput.focus();
  });

  taskList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const item = actionButton.closest("[data-id]");
    if (!item) return;
    const task = tasks.find((entry) => entry.id === item.dataset.id);
    if (!task) return;

    switch (actionButton.dataset.action) {
      case "toggle":
        task.completed = !task.completed;
        task.completedAt = task.completed ? Date.now() : null;
        saveTasks();
        render();
        showToast(task.completed ? "مهمة خلصت، برافو عليك! ✓" : "رجّعنا المهمة للمهام النشطة.");
        break;
      case "delete":
        if (window.confirm(`متأكد إنك عايز تحذف "${task.title}"؟`)) {
          tasks = tasks.filter((entry) => entry.id !== task.id);
          saveTasks();
          render();
          showToast("اتحذفت المهمة.");
        }
        break;
      case "edit":
        editingId = task.id;
        editTaskInput.value = task.title;
        editPriority.value = task.priority || "normal";
        editDate.value = task.dueDate || "";
        if (typeof editDialog.showModal === "function") editDialog.showModal();
        else showToast("المتصفح لا يدعم نافذة التعديل.");
        editTaskInput.focus();
        break;
    }
  });

  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const task = tasks.find((entry) => entry.id === editingId);
    const title = editTaskInput.value.trim();
    if (!task || !title) return;
    task.title = title;
    task.priority = editPriority.value;
    task.dueDate = editDate.value;
    saveTasks();
    editDialog.close();
    render();
    showToast("اتحفظت التعديلات.");
  });

  function closeEditDialog() {
    if (editDialog.open) editDialog.close();
    editingId = null;
  }
  $("#closeEdit").addEventListener("click", closeEditDialog);
  $("#cancelEdit").addEventListener("click", closeEditDialog);

  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
      render();
    });
  });

  searchInput.addEventListener("input", render);
  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    render();
    searchInput.focus();
  });

  $("#clearCompleted").addEventListener("click", () => {
    const count = tasks.filter((task) => task.completed).length;
    if (!count) return;
    if (window.confirm(`مسح ${count} من المهام المكتملة؟`)) {
      tasks = tasks.filter((task) => !task.completed);
      saveTasks();
      render();
      showToast("اتمسحت المهام المكتملة.");
    }
  });

  $("#emptyAddButton").addEventListener("click", () => {
    taskInput.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#todayLabel").textContent = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long", day: "numeric", month: "long"
  }).format(new Date());

  function setTheme(theme) {
    document.body.classList.toggle("dark-mode", theme === "dark");
    const button = $("#themeToggle");
    button.innerHTML = theme === "dark"
      ? '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.3A8.7 8.7 0 0 1 8.7 3.8 8.8 8.8 0 1 0 20.2 15.3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    $("#themeToggle").setAttribute("aria-label", theme === "dark" ? "تفعيل المظهر الفاتح" : "تفعيل المظهر الداكن");
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }

  $("#themeToggle").addEventListener("click", () => {
    setTheme(document.body.classList.contains("dark-mode") ? "light" : "dark");
  });

  try {
    setTheme(localStorage.getItem(THEME_KEY) || "light");
  } catch {
    setTheme("light");
  }

  render();
})();