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

  async register(username: string, password: string, displayName?: string) {
    const { data } = await this.client.post<{ token: string; user: User }>('/auth/register', {
      username, password, displayName,
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
}

export const api = new ApiService();
