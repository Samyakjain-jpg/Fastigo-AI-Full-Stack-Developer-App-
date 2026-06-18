import { create } from 'zustand';

const API_BASE = '/api';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  members?: ProjectMember[];
  tasks?: Task[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'OWNER' | 'MEMBER';
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  projectId: string;
  assigneeId?: string;
  creatorId: string;
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  creator?: {
    id: string;
    name: string;
  };
}

interface AppState {
  user: User | null;
  token: string | null;
  projects: Project[];
  activeProject: Project | null;
  activeTasks: Task[];
  users: User[];
  loading: boolean;
  error: string | null;
  realtimeAlert: string | null;

  // Auth actions
  initAuth: () => void;
  login: (credentials: { email: string; passwordStr: string }) => Promise<boolean>;
  register: (data: { name: string; email: string; passwordStr: string }) => Promise<boolean>;
  logout: () => void;
  setRealtimeAlert: (msg: string | null) => void;

  // Project actions
  fetchProjects: () => Promise<void>;
  fetchProjectById: (id: string) => Promise<void>;
  createProject: (name: string, description: string) => Promise<void>;
  addProjectMember: (projectId: string, email: string) => Promise<void>;
  fetchUsers: () => Promise<void>;

  // Task actions
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (taskData: Partial<Task>) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  updateTask: (taskId: string, updateData: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  searchTasks: (projectId: string, query: string) => Promise<void>;
  generateAiSummary: (taskId: string) => Promise<string>;

  // Real-time synchronization
  realtimeCreateTask: (task: Task) => void;
  realtimeUpdateTask: (task: Task) => void;
  realtimeDeleteTask: (taskId: string) => void;
}

export const useStore = create<AppState>((set, get) => {
  const getHeaders = () => {
    const token = get().token || localStorage.getItem('aura_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  return {
    user: null,
    token: null,
    projects: [],
    activeProject: null,
    activeTasks: [],
    users: [],
    loading: false,
    error: null,
    realtimeAlert: null,

    initAuth: () => {
      const token = localStorage.getItem('aura_token');
      const userStr = localStorage.getItem('aura_user');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr) });
      }
    },

    login: async ({ email, passwordStr }) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: passwordStr })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        localStorage.setItem('aura_token', data.token);
        localStorage.setItem('aura_user', JSON.stringify(data.user));
        set({ user: data.user, token: data.token, loading: false });
        return true;
      } catch (err: any) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    register: async ({ name, email, passwordStr }) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password: passwordStr })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        localStorage.setItem('aura_token', data.token);
        localStorage.setItem('aura_user', JSON.stringify(data.user));
        set({ user: data.user, token: data.token, loading: false });
        return true;
      } catch (err: any) {
        set({ error: err.message, loading: false });
        return false;
      }
    },

    logout: () => {
      localStorage.removeItem('aura_token');
      localStorage.removeItem('aura_user');
      set({ user: null, token: null, projects: [], activeProject: null, activeTasks: [] });
    },

    setRealtimeAlert: (msg) => {
      set({ realtimeAlert: msg });
    },

    fetchProjects: async () => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/projects`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch projects');
        set({ projects: data, loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    },

    fetchProjectById: async (id) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/projects/${id}`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch project details');
        set({ activeProject: data, activeTasks: data.tasks || [], loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    },

    createProject: async (name, description) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/projects`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ name, description })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create project');
        
        const currentProjects = get().projects;
        set({ projects: [data, ...currentProjects], loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    },

    addProjectMember: async (projectId, email) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/projects/${projectId}/members`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add project member');
        
        // Refresh project details
        await get().fetchProjectById(projectId);
        set({ loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
        throw err;
      }
    },

    fetchUsers: async () => {
      try {
        const res = await fetch(`${API_BASE}/users`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (res.ok) {
          set({ users: data });
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    },

    fetchTasks: async (projectId) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/tasks?projectId=${projectId}`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch tasks');
        set({ activeTasks: data, loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
      }
    },

    createTask: async (taskData) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(taskData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create task');

        const currentTasks = get().activeTasks;
        set({ activeTasks: [data, ...currentTasks], loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
        throw err;
      }
    },

    updateTaskStatus: async (taskId, status) => {
      // Optimistic Update
      const previousTasks = get().activeTasks;
      const updatedTasks = previousTasks.map((t) =>
        t.id === taskId ? { ...t, status } : t
      );
      set({ activeTasks: updatedTasks });

      try {
        const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update task status');
        
        // sync actual response
        const syncTasks = previousTasks.map((t) => (t.id === taskId ? data : t));
        set({ activeTasks: syncTasks });
      } catch (err: any) {
        set({ error: err.message, activeTasks: previousTasks });
      }
    },

    updateTask: async (taskId, updateData) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(updateData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update task');

        const syncTasks = get().activeTasks.map((t) => (t.id === taskId ? data : t));
        set({ activeTasks: syncTasks, loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
        throw err;
      }
    },

    deleteTask: async (taskId) => {
      set({ loading: true, error: null });
      try {
        const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete task');

        const filteredTasks = get().activeTasks.filter((t) => t.id !== taskId);
        set({ activeTasks: filteredTasks, loading: false });
      } catch (err: any) {
        set({ error: err.message, loading: false });
        throw err;
      }
    },

    searchTasks: async (projectId, query) => {
      try {
        const res = await fetch(`${API_BASE}/tasks/search?projectId=${projectId}&q=${encodeURIComponent(query)}`, {
          headers: getHeaders()
        });
        const data = await res.json();
        if (res.ok) {
          set({ activeTasks: data });
        }
      } catch (err) {
        console.error('Search failed:', err);
      }
    },

    generateAiSummary: async (taskId) => {
      try {
        const res = await fetch(`${API_BASE}/tasks/${taskId}/summary`, {
          method: 'POST',
          headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate summary');
        
        // Sync generated summary into active tasks list
        const updatedTasks = get().activeTasks.map((t) =>
          t.id === taskId ? { ...t, aiSummary: data.summary } : t
        );
        set({ activeTasks: updatedTasks });
        return data.summary;
      } catch (err: any) {
        console.error('AI generation failed:', err);
        throw err;
      }
    },

    // Real-time operations triggered by Socket.io events
    realtimeCreateTask: (task) => {
      const alreadyExists = get().activeTasks.some((t) => t.id === task.id);
      if (!alreadyExists && get().activeProject?.id === task.projectId) {
        set({ activeTasks: [task, ...get().activeTasks] });
        set({ realtimeAlert: `New Task Created: "${task.title}"` });
      }
    },

    realtimeUpdateTask: (task) => {
      if (get().activeProject?.id === task.projectId) {
        const syncTasks = get().activeTasks.map((t) => (t.id === task.id ? task : t));
        set({ activeTasks: syncTasks });
        set({ realtimeAlert: `Task Updated: "${task.title}" (${task.status})` });
      }
    },

    realtimeDeleteTask: ({ id, projectId }) => {
      if (get().activeProject?.id === projectId) {
        const filteredTasks = get().activeTasks.filter((t) => t.id !== id);
        set({ activeTasks: filteredTasks });
        set({ realtimeAlert: `A task was deleted from this project` });
      }
    }
  };
});
