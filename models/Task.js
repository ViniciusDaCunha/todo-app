/*
 * Representa uma tarefa individual no sistema
 *
 * Princípios aplicados:
 * - Immutability: Propriedades privadas com getters (Melhor para gerenciamento de estado)
 * - Encapsulation: Validação interna
 * - Single Responsibility: Apenas representa uma tarefa
 */

class Task {
  #id;
  #title;
  #completed;
  #createdAt;
  #order;

  constructor({
    title,
    completed = false,
    id = null,
    createdAt = null,
    order = 0,
  }) {
    this.#validateTitle(title);

    this.#id = id || this.#generateId();
    this.#title = title.trim();
    this.#completed = Boolean(completed);
    this.#createdAt = createdAt || Date.now();
    this.#order = order;
  }

  // Getters para expor propriedades privadas de forma imutável
  get id() {
    return this.#id;
  }

  get title() {
    return this.#title;
  }

  get completed() {
    return this.#completed;
  }

  get createdAt() {
    return this.#createdAt;
  }

  get order() {
    return this.#order;
  }


#validateTitle(title) {
    if (!title || typeof title !== 'string') {
      throw new Error('Título é obrigatório e deve ser uma string');
    }

    const t = title.trim();

    if (t.length === 0) {
      throw new Error('Título não pode ser vazio');
    }

    if (t.length > 200) {
      throw new Error('Título não pode exceder 200 caracteres');
    }

}

#generateId() {
    return crypto.randomUUID();
  }

  updateTitle(newTitle) { 
    return new Task({
      id: this.#id,
      title: newTitle,
      completed: this.#completed,
      createdAt: this.#createdAt,
      order: this.#order,
    });
  }

  updateOrder(newOrder) {
    return new Task({
      id: this.#id,
      title: this.#title,
      completed: this.#completed,
      createdAt: this.#createdAt,
      order: newOrder,
    });
  }

  toggleCompleted() {
    return new Task({
      id: this.#id,
      title: this.#title,
      completed: !this.#completed,
      createdAt: this.#createdAt,
      order: this.#order,
    });
  }

  toJSON() {
    return {
      id: this.#id,
      title: this.#title,
      completed: this.#completed,
      createdAt: this.#createdAt,
      order: this.#order,
    };
  }

  static fromJSON(data) {
    return new Task(data);
  }
}

export default Task;