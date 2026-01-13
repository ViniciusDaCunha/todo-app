/*
 * TaskRepository
 * Camada de persistência para Tasks usando localStorage
 *
 * Princípios aplicados:
 * - Repository Pattern: Abstração da fonte de dados
 * - Single Responsibility: Apenas gerencia persistência
 * - Fail-Fast: Validação rigorosa ao carregar dados
 * - Cache em memória: Performance otimizada
 */

import Task from "../models/Task.js";

class TaskRepository {
  #tasks;
  #storageKey;
  #initialized;

  constructor(storageKey = "todo_tasks") {
    this.#tasks = new Map();
    this.#storageKey = storageKey;
    this.#initialized = false;

    // Carrega tarefas do localStorage ao inicializar
    this.#initialize();
  }

  //Inicializa o repository carregando dados do localStorage
  #initialize() {
    try {
      this.#load();
      this.#initialized = true;
    } catch (error) {
      console.error("Erro ao inicializar TaskRepository:", error);
      this.#tasks = new Map();
      this.#initialized = true;
    }
  }

  //Carrega tasks do localStorage
  #load() {
    try {
      const data = localStorage.getItem(this.#storageKey);
      if (!data) {
        return;
      }
      //parse: converte JSON string para objeto JavaScript
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        throw new Error("Dados corrompidos: esperado um array de tasks");
      }

      this.#tasks.clear();
      parsed.forEach((taskData) => {
        try {
          const task = Task.fromJSON(taskData);
          this.#tasks.set(task.id, task);
        } catch (error) {
          console.warn("Task inválida ignorada", taskData, error);
        }
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Dados corrompidos no localStorage: JSON inválido");
      }
      throw error;
    }
  }

  //Persiste todas as tasks no localStorage
  #persist() {
    // Converte Map para Array de objetos serializáveis
    try {
      const tasksArray = Array.from(this.#tasks.values()).map((task) =>
        task.toJSON()
      );

      //stringify: converte objeto JavaScript para JSON string
      const json = JSON.stringify(tasksArray);
      localStorage.setItem(this.#storageKey, json);
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        throw new Error(
          "Espaço do localStorage esgotado. Remova algumas tasks."
        );
      }
      throw new Error("Falha ao salvar no localStorage:" + error.message);
    }
  }

  //Valida se o objeto é uma instância de Task
  #validateTask(task) {
    if (!(task instanceof Task)) {
      throw new TypeError("Objeto inválido: esperado uma instância de Task");
    }
  }

  save(task) {
    this.#validateTask(task);
    const previousTask = this.#tasks.get(task.id);
    const isNewtask = !this.#tasks.has(task.id);

    this.#tasks.set(task.id, task);

    try {
      this.#persist();
      return task;
    } catch (error) {
      if (isNewtask) {
        this.#tasks.delete(task.id);
      } else {
        this.#tasks.set(task.id, previousTask);
      }

      throw new Error(`Falha ao salvar a tarefa ${error.message}`, {
        cause: error,
      });
    }
  }

  exists(id) {
    return this.#tasks.has(id);
  }

  findAll() {
    return Array.from(this.#tasks.values()).map((task) =>
      Task.fromJSON(task.toJSON())
    );
  }

  findBy(predicate) {
    if (typeof predicate !== "function") {
      throw new TypeError("Predicate deve ser uma função");
    }

    return this.findAll().filter(predicate);
  }

  findById(id) {
    const task = this.#tasks.get(id);
    return task ? Task.fromJSON(task.toJSON()) : null;
  }

  delete(id) {
    const taskToDelete = this.#tasks.get(id);

    if (!taskToDelete) return false;

    this.#tasks.delete(id);

    try {
      this.#persist();
      return true;
    } catch (error) {
      this.#tasks.set(id, taskToDelete);

      throw new Error(`Falha ao persistir: ${error.message}`, { cause: error });
    }
  }

  deleteMany(ids) {
    if (!Array.isArray(ids)) {
      throw new TypeError("ids deve ser um array");
    }

    const previousTasks = new Map(this.#tasks);
    let deletedCount = 0;

    try {
      ids.forEach((id) => {
        if (this.#tasks.delete(id)) {
          deletedCount++;
        }
      });

      if (deletedCount === 0) return 0;
      this.#persist();
      return deletedCount;
    } catch (error) {
      this.#tasks = previousTasks;

      throw new Error(`Falha ao remover multiplas tarefas: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Remove todas as tasks com garantia de atomicidade
   * @returns {number} Quantidade de tasks removidas
   * @throws {Error} Se a persistência falhar
   */
  clear() {
    const previousTasks = new Map(this.#tasks);
    const count = this.#tasks.size;

    if (count === 0) return 0;

    try {
      this.#tasks.clear();
      this.#persist();
      return count;
    } catch (error) {
      this.#tasks = previousTasks;

      throw new Error(`Falha ao limpar armazenamento: ${error.message}`, {
        cause: error,
      });
    }
  }

  saveMany(tasks) {
    if (!Array.isArray(tasks)) {
      throw new TypeError("tasks deve ser um array");
    }

    const backupTasks = new Map(this.#tasks);

    try {
      tasks.forEach((task) => {
        this.#validateTask(task);
        this.#tasks.set(task.id, task);
      });

      this.#persist();
      return tasks.length;
    } catch (error) {
      this.#tasks = backupTasks;

      throw new Error(`Falha ao salvar multiplas tarefas: ${error.message}`, {
        cause: error,
      });
    }
  }

  export() {
    const tasksArray = Array.from(this.#tasks.values()).map((task) =>
      task.toJSON()
    );
    return JSON.stringify(tasksArray, null, 2);
  }

  import(jsonString) {
    const previousTasks = new Map(this.#tasks);
    try {
      const tasksArray = JSON.parse(jsonString);
      if (!Array.isArray(tasksArray)) throw new Error("JSON inválido: esperado um array de tasks");

      const tempMap = new Map();
      tasksArray.forEach((taskData) => {
        const task = Task.fromJSON(taskData);
        tempMap.set(task.id, task);
      });

      const tasksArrayRaw = Array.from(tempMap.values()).map((task) =>  task.toJSON());
      localStorage.setItem(this.#storageKey, JSON.stringify(tasksArrayRaw));

      this.#tasks = tempMap;
      this.#persist();
      return this.#tasks.size;  
    } catch (error) {
      this.#tasks = previousTasks;
      throw new Error(`Falha ao importar tarefas: ${error.message}`, { cause: error });
    }
  }

  /**
   * Retorna estatísticas do repository
   * @returns {Object} Objeto com estatísticas
   */
  getStats() {
    let completedCount = 0;

    for (const task of this.#tasks.values()) {
      if (task.completed) completedCount++; 
    }

    const pendingCount = this.#tasks.size - completedCount;

    return {
      total: this.#tasks.size,
      completed: completedCount,
      pending: pendingCount,
      completionRate: this.#tasks.size > 0 
            ? ((completedCount / this.#tasks.size) * 100).toFixed(1) + '%'
            : '0%'
    };
  }

}

export default TaskRepository;
