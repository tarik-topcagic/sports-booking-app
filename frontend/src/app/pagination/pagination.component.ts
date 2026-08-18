import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { paginate } from '../helpers/pagination.helper';

@Component({
  selector: 'app-pagination',
  imports: [NgIf, NgFor],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent<T = unknown> implements OnChanges {
  @Input() items: T[] = [];
  @Input({ required: true }) pageSize!: number;
  @Input() resetKey: unknown;
  @Input() ariaLabel = '';
  @Output() pagedItemsChange = new EventEmitter<T[]>();

  currentPage = 1;
  totalPages = 0;
  totalPagesArray: number[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetKey'] && !changes['resetKey'].firstChange) {
      this.currentPage = 1;
    }

    if (changes['items'] || changes['pageSize'] || changes['resetKey']) {
      this.recompute();
    }
  }

  previousPage(event: Event): void {
    event.preventDefault();
    if (this.currentPage > 1) {
      this.currentPage--;
      this.recompute();
    }
  }

  nextPage(event: Event): void {
    event.preventDefault();
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.recompute();
    }
  }

  goToPage(page: number, event: Event): void {
    event.preventDefault();
    this.currentPage = page;
    this.recompute();
  }

  private recompute(): void {
    const result = paginate(this.items, this.currentPage, this.pageSize);
    this.totalPages = result.totalPages;
    this.totalPagesArray = result.totalPagesArray;

    Promise.resolve().then(() => {
      this.pagedItemsChange.emit(result.pagedItems);
    });
  }
}
