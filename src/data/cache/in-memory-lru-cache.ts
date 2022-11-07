import { MemoryCache } from '../@types';
import { CacheNode } from './in-memory-cache';

export class InMemoryLRUCache<T> implements MemoryCache<T> {

  private map = new Map<string, CacheNode<T>>();
  private head?: CacheNode<T>;
  private tail?: CacheNode<T>;

  constructor(private readonly size: number) { }

  get(id: string): T | undefined {
    let val: T | undefined;
    const node = this.map.get(id);
    if (node) {
      if (node.prev) {
        this.remove(node);
        this.push(node);
      }
      val = node.value;
    }
    return val;
  }

  set(id: string, val: T): void {
    let node: CacheNode<T>;
    if (this.map.size === this.size && this.tail) {
      node = this.tail;
      this.map.delete(node.id);
      this.remove(node);
      node.reset(id, val);
    } else {
      node = new CacheNode(id, val);
    }
    this.push(node);
    this.map.set(id, node);
  }

  private push(node: CacheNode<T>) {
    if (!this.head) {
      this.head = node;
      this.tail = this.head;
    } else {
      this.head.prev = node;
      node.next = this.head;
      this.head = node;
    }
  }

  private remove(node: CacheNode<T>) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = undefined;
    node.next = undefined;
  }

}
