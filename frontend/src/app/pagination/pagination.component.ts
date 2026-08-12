import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  imports: [NgIf, NgFor],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  @Input() currentPage = 1;
  @Input() totalPages = 0;
  @Input() totalPagesArray: number[] = [];
  @Input() ariaLabel = '';
  @Output() pageChange = new EventEmitter<number>();

  previousPage(event: Event): void {
    event.preventDefault();
    if (this.currentPage > 1) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  nextPage(event: Event): void {
    event.preventDefault();
    if (this.currentPage < this.totalPages) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }

  goToPage(page: number, event: Event): void {
    event.preventDefault();
    this.pageChange.emit(page);
  }
}
