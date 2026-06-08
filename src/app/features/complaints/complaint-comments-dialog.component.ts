import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CustomerCommentService } from '../../core/services/customer-comment.service';
import { CustomerComment } from '../../core/models/models';

interface ComplaintCommentsDialogData {
  complaintId: number;
  customerId: number;
  customerName: string;
  complaint: string;
  resolved?: boolean;
}

@Component({
  selector: 'app-complaint-comments-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>Complaint Comments</h2>
    <div mat-dialog-content>
      <div class="complaint-detail">
        <p><strong>Customer:</strong> {{ data.customerName }}</p>
        <p><strong>Complaint:</strong> {{ data.complaint }}</p>
        <p><strong>Status:</strong> {{ data.resolved ? 'Resolved' : 'Open' }}</p>
      </div>

      <form [formGroup]="form" *ngIf="!data.resolved" style="margin-top:16px">
        <mat-form-field appearance="outline" style="width:100%">
          <mat-label>Add comment</mat-label>
          <textarea matInput formControlName="comment" rows="4"></textarea>
          <mat-error *ngIf="form.controls.comment.invalid && form.controls.comment.touched">
            Comment is required.
          </mat-error>
        </mat-form-field>
      </form>

      <div class="comment-list" style="margin-top:24px">
        <h4>{{ comments.length }} Comment{{ comments.length === 1 ? '' : 's' }}</h4>
        <div *ngIf="comments.length === 0" class="empty-comment-state">
          <p>No comments yet.</p>
          <p *ngIf="!data.resolved">Use the field above to add a follow-up note.</p>
        </div>
        <div *ngFor="let comment of comments" class="comment-item" style="border:1px solid #e0e0e0; padding:12px; border-radius:8px; margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:6px;">
            <strong>Comment</strong>
            <span style="font-size:0.85rem; color:#666">{{ comment.createdAt | date:'dd MMM yyyy, hh:mm a' }}</span>
          </div>
          <div>{{ comment.comment }}</div>
        </div>
      </div>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="close()">Close</button>
      <button mat-raised-button color="primary" type="button" [disabled]="form.invalid || data.resolved" (click)="saveComment()" *ngIf="!data.resolved">
        <mat-icon>send</mat-icon>
        Add Comment
      </button>
    </div>
  `
})
export class ComplaintCommentsDialogComponent implements OnInit {
  form = new FormGroup({
    comment: new FormControl<string>('', [Validators.required, Validators.maxLength(1000)])
  });

  comments: CustomerComment[] = [];
  private commentSvc = inject(CustomerCommentService);
  private dialogRef = inject(MatDialogRef<ComplaintCommentsDialogComponent>);
  private snack = inject(MatSnackBar);
  readonly data = inject(MAT_DIALOG_DATA) as ComplaintCommentsDialogData;

  ngOnInit(): void {
    this.loadComments();
  }

  loadComments(): void {
    this.commentSvc.getByComplaint(this.data.complaintId).subscribe(comments => {
      this.comments = comments;
    });
  }

  saveComment(): void {
    if (this.form.invalid) {
      return;
    }

    const commentText = this.form.get('comment')?.value?.toString().trim();
    if (!commentText) {
      return;
    }

    this.commentSvc.add({
      customerId: this.data.customerId,
      complaintId: this.data.complaintId,
      comment: commentText
    }).subscribe(() => {
      this.snack.open('Comment added', 'OK', { duration: 3000 });
      this.form.reset();
      this.loadComments();
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
