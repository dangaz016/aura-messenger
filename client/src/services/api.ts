import axios, { AxiosInstance } from 'axios';
import { User, Chat, Message, AuraMode, StoryGroup, Story, StoryType, StoryViewer } from '../types';

const TOKEN_KEY = 'aura_token';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
    });

    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  fileUrl(fileId: string): string {
    return `${API_BASE}/files/${fileId}`;
  }

  async getCaptcha(): Promise<{ id: string; question: string }> {
    const { data } = await this.client.get('/auth/captcha');
    return data;
  }

  async getPowChallenge(): Promise<{ id: string; challenge: string; difficulty: number }> {
    const { data } = await this.client.get('/auth/pow');
    return data;
  }

  async register(
    username: string,
    password: string,
    displayName?: string,
    captchaId?: string,
    captchaAnswer?: string,
    powId?: string,
    powNonce?: string,
    behaviorScore?: number,
    timeOnPage?: number,
  ) {
    const { data } = await this.client.post<{ token: string; user: User }>('/auth/register', {
      username, password, displayName,
      captchaId, captchaAnswer,
      powId, powNonce,
      honeypot: '',   // must always be empty from legitimate client
      behaviorScore,
      timeOnPage,
    });
    this.setToken(data.token);
    return data;
  }

  async login(username: string, password: string) {
    const { data } = await this.client.post<{ token: string; user: User }>('/auth/login', {
      username, password,
    });
    this.setToken(data.token);
    return data;
  }

  async me() {
    const { data } = await this.client.get<{ user: User }>('/auth/me');
    return data.user;
  }

  async searchUsers(query: string) {
    const { data } = await this.client.get<{ users: User[] }>('/users/search', { params: { q: query } });
    return data.users;
  }

  async updateProfile(updates: Partial<{
    displayName: string;
    moodEmoji: string;
    moodText: string;
    auraMode: AuraMode;
    avatarColor: string;
    publicKey: string;
    avatarUrl: string;
    bio: string;
    birthday: string;
  }>) {
    const { data } = await this.client.patch<{ user: User }>('/users/profile', updates);
    return data.user;
  }

  async changeUsername(newUsername: string) {
    const { data } = await this.client.patch<{ user: User }>('/users/username', { newUsername });
    return data.user;
  }

  async getUser(id: string) {
    const { data } = await this.client.get<{ user: User }>(`/users/${id}`);
    return data.user;
  }

  async getChats() {
    const { data } = await this.client.get<{ chats: Chat[] }>('/chats');
    return data.chats;
  }

  async createChat(type: 'direct' | 'group' | 'space', memberIds: string[], name?: string, description?: string) {
    const { data } = await this.client.post<{ chat: Chat & { existing?: boolean } }>('/chats', {
      type, memberIds, name, description,
    });
    return data.chat;
  }

  async getChat(id: string) {
    const { data } = await this.client.get<{ chat: Chat }>(`/chats/${id}`);
    return data.chat;
  }

  async getMessages(chatId: string, before?: number, limit = 50) {
    const { data } = await this.client.get<{ messages: Message[] }>(`/chats/${chatId}/messages`, {
      params: { before, limit },
    });
    return data.messages;
  }

  async markRead(chatId: string) {
    await this.client.post(`/chats/${chatId}/read`);
  }

  async deleteMessage(chatId: string, messageId: string) {
    await this.client.delete(`/chats/${chatId}/messages/${messageId}`);
  }

  async uploadFile(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await this.client.post<{ file: { id: string; url: string; originalName: string; mimeType: string; size: number } }>(
      '/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data.file;
  }

  // ===== STORIES =====
  async getStoryFeed() {
    const { data } = await this.client.get<{ feed: StoryGroup[] }>('/stories');
    return data.feed;
  }

  async createStory(payload: { type: StoryType; content?: string; fileId?: string; bgColor?: string }) {
    const { data } = await this.client.post<{ story: Story }>('/stories', payload);
    return data.story;
  }

  async viewStory(storyId: string) {
    await this.client.post(`/stories/${storyId}/view`);
  }

  async deleteStory(storyId: string) {
    await this.client.delete(`/stories/${storyId}`);
  }

  async getStoryViewers(storyId: string) {
    const { data } = await this.client.get<{ viewers: StoryViewer[] }>(`/stories/${storyId}/viewers`);
    return data.viewers;
  }

  async reactToStory(storyId: string, emoji: string) {
    await this.client.post(`/stories/${storyId}/react`, { emoji });
  }

  // ===== AI =====
  async aiStatus() {
    const { data } = await this.client.get<{ available: boolean; model: string | null }>('/ai/status');
    return data;
  }

  async aiChat(message: string, history: { role: 'user' | 'assistant'; content: string }[], lang: 'en' | 'ru') {
    const { data } = await this.client.post<{ reply: string }>('/ai/chat', { message, history, lang });
    return data.reply;
  }

  async aiSuggestReply(lastMessages: { senderName: string; content: string; isOwn: boolean }[], lang: 'en' | 'ru') {
    const { data } = await this.client.post<{ suggestions: string[] }>('/ai/suggest-reply', { lastMessages, lang });
    return data.suggestions;
  }

  async aiSummarize(messages: { senderName: string; content: string }[], lang: 'en' | 'ru') {
    const { data } = await this.client.post<{ summary: string }>('/ai/summarize', { messages, lang });
    return data.summary;
  }

  // ===== STORY COMMENTS =====
  async getStoryComments(storyId: string) {
    const { data } = await this.client.get(`/stories/${storyId}/comments`);
    return data;
  }

  async addStoryComment(storyId: string, content: string) {
    const { data } = await this.client.post(`/stories/${storyId}/comments`, { content });
    return data;
  }

  // ===== CHANNELS =====
  async createChannel(opts: { name: string; description?: string; isPublic?: boolean; channelUsername?: string }) {
    const { data } = await this.client.post<{ chat: Chat }>('/chats', {
      type: 'channel', memberIds: [],
      name: opts.name,
      description: opts.description,
      isPublic: opts.isPublic !== false,
      channelUsername: opts.channelUsername,
    });
    return data.chat;
  }

  async updateChatSettings(chatId: string, settings: {
    name?: string; description?: string; isPublic?: boolean;
    channelUsername?: string; postPermissions?: string; avatarColor?: string;
  }) {
    const { data } = await this.client.patch(`/chats/${chatId}/settings`, settings);
    return data.chat;
  }

  async joinByInviteLink(inviteLink: string) {
    const { data } = await this.client.post<{ chatId: string; chat: Chat }>(`/chats/join/${inviteLink}`);
    return data;
  }

  async leaveChat(chatId: string) {
    await this.client.delete(`/chats/${chatId}/leave`);
  }

  async searchPublicChannels(q: string) {
    const { data } = await this.client.get<unknown[]>('/chats/search/public', { params: { q } });
    return data;
  }

  // ===== ADMIN =====
  async adminStats() {
    const { data } = await this.client.get('/admin/stats');
    return data;
  }

  async adminUsers(search = '', page = 1) {
    const { data } = await this.client.get('/admin/users', { params: { search, page } });
    return data;
  }

  async adminBanUser(userId: string, reason: string) {
    await this.client.post(`/admin/users/${userId}/ban`, { reason });
  }

  async adminUnbanUser(userId: string) {
    await this.client.post(`/admin/users/${userId}/unban`);
  }

  async adminFreezeUser(userId: string, durationMinutes?: number, reason?: string) {
    await this.client.post(`/admin/users/${userId}/freeze`, { durationMinutes, reason });
  }

  async adminUnfreezeUser(userId: string) {
    await this.client.post(`/admin/users/${userId}/unfreeze`);
  }

  async adminMakeAdmin(userId: string) {
    await this.client.post(`/admin/users/${userId}/make-admin`);
  }

  async adminGetReports() {
    const { data } = await this.client.get('/admin/reports');
    return data;
  }

  async reportUser(targetUserId: string, reason: string) {
    await this.client.post('/report', { targetUserId, reason });
  }

  async generateInviteLink(chatId: string) {
    const { data } = await this.client.post<{ inviteLink: string }>(`/chats/${chatId}/invite`);
    return data.inviteLink;
  }

  async kickMember(chatId: string, userId: string) {
    await this.client.post(`/chats/${chatId}/kick`, { userId });
  }

  async promoteMember(chatId: string, userId: string, role: 'admin' | 'member') {
    await this.client.post(`/chats/${chatId}/promote`, { userId, role });
  }

  // ===== GOOGLE OAUTH =====
  async googleStatus() {
    const { data } = await this.client.get<{ available: boolean; clientId: string | null }>('/auth/google/status');
    return data;
  }

  async googleSignIn(credential: string) {
    const { data } = await this.client.post<{ token: string; user: User }>('/auth/google', { credential });
    this.setToken(data.token);
    return data;
  }

  // ===== TELEGRAM AUTH =====
  async telegramStatus() {
    const { data } = await this.client.get<{ available: boolean; botToken: string | null }>('/auth/telegram/status');
    return data;
  }

  async telegramSignIn(tgData: Record<string, string | number>) {
    const { data } = await this.client.post<{ token: string; user: User }>('/auth/telegram', tgData);
    this.setToken(data.token);
    return data;
  }

  async telegramLink(tgData: Record<string, string | number>) {
    const { data } = await this.client.post<{ user: User }>('/auth/telegram/link', tgData);
    return data;
  }

  // ===== AURA PRIME =====
  async primeStatus() {
    const { data } = await this.client.get<{ user: User }>('/prime/status');
    return data.user;
  }

  async primeUpdateSettings(settings: { theme?: string; badge?: string; animatedAvatar?: boolean }) {
    const { data } = await this.client.patch<{ user: User }>('/prime/settings', settings);
    return data.user;
  }

  async primeGrant(userId: string, durationDays?: number) {
    const { data } = await this.client.post<{ user: User }>('/prime/grant', { userId, durationDays });
    return data.user;
  }

  async primeRevoke(userId: string) {
    const { data } = await this.client.post<{ user: User }>('/prime/revoke', { userId });
    return data.user;
  }
}

export const api = new ApiService();
