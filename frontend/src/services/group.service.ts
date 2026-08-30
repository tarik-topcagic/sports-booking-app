import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { Group, GroupChatMessage, GroupDetails, GroupMembershipState } from '../app/interfaces/group.model';
import { MessageReaction } from '../app/interfaces/message-reaction.model';

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private apiUrl = environment.apiUrl + '/groups';
  private membershipChangedSubject = new Subject<void>();
  private groupDetailsRefreshSubject = new Subject<number>();
  membershipChanged$ = this.membershipChangedSubject.asObservable();
  groupDetailsRefresh$ = this.groupDetailsRefreshSubject.asObservable();

  constructor(private http: HttpClient) {}

  createGroup(data: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.apiUrl}/create`, data, { headers }).pipe(
      tap(() => this.notifyMembershipChanged()),
    );
  }

  updateGroup(groupId: number, updateData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${groupId}/update`, updateData).pipe(
      tap(() => {
        this.notifyGroupDetailsRefresh(groupId);
        this.notifyMembershipChanged();
      }),
    );
  }

  deleteGroup(groupId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${groupId}`).pipe(
      tap(() => this.notifyMembershipChanged()),
    );
  }

  getGroupDetails(groupId: number): Observable<GroupDetails> {
    return this.http.get<GroupDetails>(`${this.apiUrl}/${groupId}`);
  }

  requestToJoin(groupId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${groupId}/join-request`, {});
  }

  sendInvite(groupId: number, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${groupId}/invite`, { userId });
  }

  cancelInvitation(groupId: number, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${groupId}/invitations/${encodeURIComponent(userId)}`);
  }

  getGroupMemberships(groupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${groupId}/memberships`);
  }

  removeMember(groupId: number, memberId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${groupId}/members/${encodeURIComponent(memberId)}`).pipe(
      tap(() => this.notifyMembershipChanged()),
    );
  }

  cancelJoinRequest(groupId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${groupId}/join-request`);
  }

  respondInvite(membershipId: number, accept: boolean, groupId?: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/respond-invite`, {
      membershipId,
      accept,
    }).pipe(
      tap(() => {
        if (groupId) {
          this.notifyGroupDetailsRefresh(groupId);
        }

        if (accept) {
          this.notifyMembershipChanged();
        }
      }),
    );
  }

  respondJoinRequest(groupId: number, membershipId: number, accept: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/${groupId}/respond-request`, {
      membershipId,
      accept,
    }).pipe(
      tap(() => this.notifyGroupDetailsRefresh(groupId)),
    );
  }

  getMyGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/admin`);
  }

  getMembershipStatusForAdminGroups(userId: string): Observable<GroupMembershipState[]> {
    return this.http.get<GroupMembershipState[]>(
      `${this.apiUrl}/admin/membership-status/${encodeURIComponent(userId)}`,
    );
  }

  getMemberGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/membership`);
  }

  getPendingJoinRequestGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/pending-requests`);
  }

  getPendingInvitationGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.apiUrl}/pending-invitations`);
  }

  searchGroups(query: string = ''): Observable<Group[]> {
    let url = `${this.apiUrl}/search-groups`;
    if (query.trim()) {
      url += `?query=${encodeURIComponent(query.trim())}`;
    }
    return this.http.get<any[]>(url);
  }

  uploadGroupPicture(groupId: number, formData: FormData): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${groupId}/upload-group-picture`,
      formData,
    );
  }

  deleteGroupPicture(groupId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${groupId}/delete-group-picture`);
  }

  getGroupMessages(groupId: number): Observable<GroupChatMessage[]> {
    return this.http.get<GroupChatMessage[]>(`${this.apiUrl}/${groupId}/messages`);
  }

  sendGroupMessage(groupId: number, messageText: string, replyToMessageId?: number | null): Observable<GroupChatMessage> {
    return this.http.post<GroupChatMessage>(`${this.apiUrl}/${groupId}/messages`, { messageText, replyToMessageId });
  }

  deleteGroupMessage(groupId: number, messageId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${groupId}/messages/${messageId}`);
  }

  setGroupMessagePinned(groupId: number, messageId: number, isPinned: boolean): Observable<{ isPinned: boolean; pinnedAt: string | null }> {
    return this.http.post<{ isPinned: boolean; pinnedAt: string | null }>(
      `${this.apiUrl}/${groupId}/messages/${messageId}/pin`,
      { isPinned },
    );
  }

  addOrUpdateGroupMessageReaction(groupId: number, messageId: number, emoji: string): Observable<MessageReaction[]> {
    return this.http.post<MessageReaction[]>(`${this.apiUrl}/${groupId}/messages/${messageId}/reactions`, { emoji });
  }

  removeGroupMessageReaction(groupId: number, messageId: number): Observable<MessageReaction[]> {
    return this.http.delete<MessageReaction[]>(`${this.apiUrl}/${groupId}/messages/${messageId}/reactions`);
  }

  notifyMembershipChanged(): void {
    this.membershipChangedSubject.next();
  }

  notifyGroupDetailsRefresh(groupId: number): void {
    this.groupDetailsRefreshSubject.next(groupId);
  }
}
