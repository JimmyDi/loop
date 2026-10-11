import { randomUUID } from "node:crypto";

import type { PromptContent } from "@loop/agent";
import { validateMessages } from "./messages";

export type QueuedMessage = {
  id: string;
  content: PromptContent;
  skills: string[];
  steering: boolean;
  editing?: boolean;
};

export class MessageQueue {
  private items: QueuedMessage[] = [];
  private bypassedEdits = new Set<string>();

  get messages(): QueuedMessage[] {
    return structuredClone(this.items);
  }

  add(content: PromptContent, skills: string[] = [], id: string = randomUUID()): string {
    this.validate(content, skills);
    if (!id || this.items.some((item) => item.id === id)) throw new Error("Duplicate queue ID");
    this.items.push({
      id,
      content: structuredClone(content),
      skills: [...skills],
      steering: false,
    });
    return id;
  }

  edit(id: string, content: PromptContent, skills?: string[]): void {
    const item = this.find(id);
    this.validate(content, skills ?? item.skills);
    if (item.steering) throw new Error("Message is awaiting a steering boundary");
    item.content = structuredClone(content);
    if (skills) item.skills = [...skills];
    if (this.bypassedEdits.delete(id)) this.move(id);
    item.editing = false;
  }

  beginEdit(id: string): void {
    const item = this.find(id);
    if (item.steering) throw new Error("Message is awaiting a steering boundary");
    item.editing = true;
  }

  cancelEdit(id: string): void {
    this.find(id).editing = false;
    this.bypassedEdits.delete(id);
  }

  remove(id: string): void {
    const item = this.find(id);
    if (item.steering) throw new Error("Message is awaiting a steering boundary");
    this.items.splice(this.items.indexOf(item), 1);
    this.bypassedEdits.delete(id);
  }

  move(id: string, beforeId?: string): void {
    const item = this.find(id);
    if (id === beforeId) return;
    const before = beforeId === undefined ? undefined : this.find(beforeId);
    this.items.splice(this.items.indexOf(item), 1);
    this.items.splice(before ? this.items.indexOf(before) : this.items.length, 0, item);
  }

  steer(id: string): void {
    const item = this.find(id);
    if (item.editing) throw new Error("Message is being edited");
    item.steering = true;
  }

  peek(steeringOnly = false): QueuedMessage | undefined {
    let index = this.items.findIndex((item) => item.steering && !item.editing);
    if (index < 0 && !steeringOnly) index = this.items.findIndex((item) => !item.editing);
    if (index < 0) return;
    return structuredClone(this.items[index]);
  }

  take(steeringOnly = false): QueuedMessage | undefined {
    const next = this.peek(steeringOnly);
    if (!next) return;
    const index = this.items.findIndex((item) => item.id === next.id);
    for (const item of this.items.slice(0, index)) {
      if (item.editing) this.bypassedEdits.add(item.id);
    }
    return this.items.splice(index, 1)[0];
  }

  private find(id: string): QueuedMessage {
    const item = this.items.find((item) => item.id === id);
    if (!item) throw new Error("Queued message no longer exists");
    return item;
  }

  private validate(content: PromptContent, skills: string[]): void {
    if (typeof content === "string" ? !content.trim() : !Array.isArray(content) || !content.length)
      throw new Error("Prompt is required");
    validateMessages([{ role: "user", content, timestamp: 0 }]);
    if (
      !Array.isArray(skills) ||
      skills.length > 8 ||
      skills.some((id) => !/^[a-f0-9]{24}$/.test(id))
    )
      throw new Error("Invalid skill selection");
  }
}
