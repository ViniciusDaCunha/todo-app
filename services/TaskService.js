/**
 * TaskService
 * Camada de lógica de negócios para gerenciamento de Tasks
 *
 * Princípios aplicados:
 * - Service Layer Pattern: Encapsula regras de negócio
 * - Dependency Inversion: Depende de abstração (repository injetado)
 * - Single Responsibility: Apenas lógica de negócio
 * - Strategy Pattern: Filtros como estratégias
 *
 * Responsabilidades:
 * - Coordenar operações entre Task e Repository
 * - Aplicar regras de negócio (filtros, validações)
 * - Transformar dados para consumo da UI
 * - Gerenciar estatísticas e contadores
 *
 */

import Task from "../models/Task.js";

class TaskService {
  #repository;
  #filterStrategies;
  #sortStrategies;

  constructor(repository) {
    if (!repository) {
      throw new Error("TaskService requer um repository");
    }

    this.#repository = repository;
    this.#initializeStrategies();
  }

  #initializeStrategies() {
    this.#filterStrategies = {
      all: (tasks) => tasks,
      completed: (tasks) => tasks.filter((task) => task.completed),
      pending: (tasks) => tasks.filter((task) => !task.completed),
    };

    this.#sortStrategies = {
      title: (a, b) => a.title.localeCompare(b.title),
      createdAt: (a, b) => a.createdAt - b.createdAt,
      order: (a, b) => a.order - b.order,
    };
  }

  #validateFilter(filter) {
    if (!this.#filterStrategies[filter]) {
      throw new Error(
        `Filtro inválido: "${filter}". Use: ${Object.keys(this.#filterStrategies).join(", ")}`,
      );
    }
  }

  /**
   * Valida se a task existe no repository
   * @private
   * @param {string} taskId - ID da task
   * @throws {Error} Se task não existir
   * @returns {Task} Task encontrada
   */
  #ensureTaskExists(taskId) {
    const task = this.#repository.findById(taskId);
    if (!task) {
      throw new Error(`Task com ID "${taskId}" não encontrada`);
    }
    return task;
  }

  createTask(title) {
    const task = new Task({ title });
    return this.#repository.save(task);
  }

  updateTask(taskId, updates) {
    const currentTask = this.#ensureTaskExists(taskId);

    let updatedTask = currentTask;

    try {
      if (updates.title !== undefined) {
        updatedTask = updatedTask.updateTitle(updates.title);
      }
      if (
        updates.completed !== undefined &&
        updates.completed !== currentTask.completed
      ) {
        updatedTask = updatedTask.toggleCompleted();
      }
      if (updates.order !== undefined) {
        updatedTask = updatedTask.updateOrder(updates.order);
      }

      return this.#repository.save(updatedTask);
    } catch (error) {
      throw new Error(`Falha ao atualizar task: ${error.message}`, {
        cause: error,
      });
    }
  }

  toggleTaskCompletion(taskId) {
    const currentTask = this.#ensureTaskExists(taskId);
    const toggleTask = currentTask.toggleCompleted();
    return this.#repository.save(toggleTask);
  }

  /**
   * Atualiza a ordem de múltiplas tasks (para drag & drop)
   *
   * @param {Array<{id: string, order: number}>} reorderedTasks - Tasks com novas ordens
   * @returns {number} Quantidade de tasks atualizadas
   *
   * @example
   * service.reorderTasks([
   *   { id: 'task1', order: 0 },
   *   { id: 'task2', order: 1 }
   * ]);
   */
  reorderTasks(reorderedTasks) {
    if (!Array.isArray(reorderedTasks)) {
      throw new TypeError("reorderedTasks deve ser um array");
    }

    const tasksToUpdate = reorderedTasks.map(({ id, order }) => {
      const task = this.#ensureTaskExists(id);
      return task.updateOrder(order);
    });

    return this.#repository.saveMany(tasksToUpdate);
  }

  deleteTask(taskId) {
    this.#ensureTaskExists(taskId);
    return this.#repository.delete(taskId);
  }

  clearCompleted() {
    const completedTasks = this.#repository.findBy((task) => task.completed);
    const ids = completedTasks.map((task) => task.id);
    return this.#repository.deleteMany(ids);
  }

  clearAll() {
    return this.#repository.clear();
  }

  getTasks(filter = "all") {
    this.#validateFilter(filter);
    const allTasks = this.#repository.findAll();
    const filterStrategy = this.#filterStrategies[filter];
    return filterStrategy(allTasks);
  }

  getTasksSorted(sortedBy = "createdAt", filter = "all") {
    const tasks = this.getTasks(filter);
    const sortStrategy = this.#sortStrategies[sortedBy];

    if (!sortStrategy) {
      throw new Error(
        `Critério de ordenação inválido: "${sortedBy}". Use: ${Object.keys(this.#sortStrategies).join(", ")}`,
      );
    }

    return [...tasks].sort(sortStrategy);
  }

  getTaskById(taskId) {
    return this.#repository.findById(taskId);
  }

  searchTasks(searchTerm) {
    if (!searchTerm || typeof searchTerm !== "string") {
      return [];
    }

    const normalizedTerm = searchTerm.trim().toLowerCase();

    return this.#repository.findBy((task) =>
      task.title.toLowerCase().includes(normalizedTerm),
    );
  }

  getStatistics() {
    const total = this.#repository.count();
    const completed = this.#repository.countBy((task) => task.completed);
    const pending = total - completed;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, pending, completionRate };
  }

  hasTask() {
    return this.#repository.count() > 0;
  }

  hasCompletedTasks() {
    return this.#repository.countBy((task) => task.completed) > 0;
  }

  hasPendingTasks() {
    return this.#repository.countBy((task) => !task.completed) > 0;
  }

  exportTasks() {
    return this.#repository.export();
  }

  importTasks(jsonString) {
    return this.#repository.import(jsonString);
  }
}

export default TaskService;
