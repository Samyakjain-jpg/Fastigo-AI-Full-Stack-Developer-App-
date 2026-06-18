import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  useStore, 
  Task, 
  TaskStatus, 
  TaskPriority, 
  User, 
  Project 
} from './store/store';
import { 
  Plus, 
  LogOut, 
  Search, 
  UserPlus, 
  Briefcase, 
  User as UserIcon, 
  Calendar, 
  AlertTriangle, 
  Sparkles, 
  CheckCircle, 
  X, 
  Activity, 
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Clock
} from 'lucide-react';

export default function App() {
  const {
    user,
    initAuth,
    login,
    register,
    logout,
    projects,
    activeProject,
    activeTasks,
    users,
    loading,
    error,
    realtimeAlert,
    setRealtimeAlert,
    fetchProjects,
    fetchProjectById,
    createProject,
    addProjectMember,
    fetchUsers,
    createTask,
    updateTaskStatus,
    updateTask,
    deleteTask,
    searchTasks,
    generateAiSummary,
    realtimeCreateTask,
    realtimeUpdateTask,
    realtimeDeleteTask
  } = useStore();

  // Navigation & Modal States
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const [searchVal, setSearchVal] = useState('');

  // Socket state
  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize Authentication on Mount
  useEffect(() => {
    initAuth();
  }, []);

  // Fetch initial dashboard data upon login
  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchUsers();
    }
  }, [user]);

  // Handle Project Change & Socket Room Subscriptions
  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket server
    const socketBase = window.location.origin.replace('3000', '5000'); // Fallback for docker/development mapping
    const newSocket = io(socketBase);
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Join/leave project room when activeProject changes
  useEffect(() => {
    if (!socket || !activeProject) return;

    socket.emit('join_project', activeProject.id);

    socket.on('task_created', (task: Task) => {
      realtimeCreateTask(task);
    });

    socket.on('task_updated', (task: Task) => {
      realtimeUpdateTask(task);
      if (selectedTask?.id === task.id) {
        setSelectedTask(task);
      }
    });

    socket.on('task_deleted', (data: { id: string, projectId: string }) => {
      realtimeDeleteTask(data);
      if (selectedTask?.id === data.id) {
        setDetailModalOpen(false);
        setSelectedTask(null);
      }
    });

    return () => {
      socket.emit('leave_project', activeProject.id);
      socket.off('task_created');
      socket.off('task_updated');
      socket.off('task_deleted');
    };
  }, [socket, activeProject, selectedTask]);

  // Auto-hide real-time alerts
  useEffect(() => {
    if (realtimeAlert) {
      const timer = setTimeout(() => {
        setRealtimeAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [realtimeAlert]);

  // Auto load first project if available
  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      fetchProjectById(projects[0].id);
    }
  }, [projects]);

  // Fuzzy search trigger
  const handleSearch = (val: string) => {
    setSearchVal(val);
    if (activeProject) {
      searchTasks(activeProject.id, val);
    }
  };

  // Auth form submissions
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login({ email: emailInput, passwordStr: passwordInput });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register({ name: nameInput, email: emailInput, passwordStr: passwordInput });
  };

  // Project Creation
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    await createProject(projectName, projectDesc);
    setProjectName('');
    setProjectDesc('');
    setProjectModalOpen(false);
  };

  // Invite Member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !memberEmail.trim()) return;
    try {
      await addProjectMember(activeProject.id, memberEmail);
      setMemberEmail('');
      setMemberModalOpen(false);
      setRealtimeAlert(`Successfully added member: ${memberEmail}`);
    } catch (err: any) {
      alert(err.message || 'Failed to add member');
    }
  };

  // Task Creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !taskName.trim()) return;
    try {
      await createTask({
        title: taskName,
        description: taskDesc,
        priority: taskPriority,
        dueDate: taskDueDate || undefined,
        assigneeId: taskAssignee || undefined,
        projectId: activeProject.id
      });
      setTaskName('');
      setTaskDesc('');
      setTaskPriority('MEDIUM');
      setTaskAssignee('');
      setTaskDueDate('');
      setTaskModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create task');
    }
  };

  // AI Summary Trigger
  const handleTriggerAiSummary = async (taskId: string) => {
    setAiGenerating(true);
    try {
      const summary = await generateAiSummary(taskId);
      if (selectedTask) {
        setSelectedTask({ ...selectedTask, aiSummary: summary });
      }
    } catch (err) {
      alert('AI Generation failed. Ensure description is populated.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUpdateTaskDetail = async (updatedFields: Partial<Task>) => {
    if (!selectedTask) return;
    try {
      await updateTask(selectedTask.id, updatedFields);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTaskClick = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask(taskId);
      setDetailModalOpen(false);
      setSelectedTask(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Kanban status grouping
  const getTasksByStatus = (status: TaskStatus) => {
    return activeTasks.filter((t) => t.status === status);
  };

  // Non-Authenticated Login/Register View
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card glass-panel">
          <div className="auth-header">
            <h1>AuraTask</h1>
            <p>{isRegistering ? 'Start organizing beautifully' : 'Access your next-gen workspaces'}</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: '0.9rem', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit}>
            {isRegistering && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="John Doe"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
            )}
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="you@domain.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="form-input"
                required
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 12 }}>
              {loading ? 'Processing...' : isRegistering ? 'Register Workspace' : 'Launch Workspace'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {isRegistering ? (
              <span>Already have an account? <a href="#" onClick={() => setIsRegistering(false)} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>Log In</a></span>
            ) : (
              <span>New to AuraTask? <a href="#" onClick={() => setIsRegistering(true)} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>Create an account</a></span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel" style={{ borderRadius: 0 }}>
        <div className="sidebar-logo">
          ⚡ AuraTask
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: '0.05em', marginBottom: 12 }}>
            Your Projects
          </div>
          
          <ul className="sidebar-menu">
            {projects.map((proj) => (
              <li
                key={proj.id}
                className={`menu-item ${activeProject?.id === proj.id ? 'active' : ''}`}
                onClick={() => fetchProjectById(proj.id)}
              >
                <Briefcase size={16} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{proj.name}</span>
              </li>
            ))}
          </ul>

          <button 
            className="btn btn-secondary" 
            onClick={() => setProjectModalOpen(true)} 
            style={{ marginTop: 16, padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> Create Project
          </button>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass-panel" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderRadius: 10 }}>
            <div className="avatar-circle">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={logout} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {activeProject ? (
          <>
            {/* Header section */}
            <header className="content-header">
              <div>
                <h2 style={{ fontSize: '2rem', marginBottom: 6 }}>{activeProject.name}</h2>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>{activeProject.description || 'No description provided.'}</p>
              </div>

              <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: '580px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <div className="search-wrapper">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Fuzzy search tasks..."
                    value={searchVal}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>

                <button className="btn btn-secondary" onClick={() => setMemberModalOpen(true)} style={{ width: 'auto', padding: '10px 16px' }}>
                  <UserPlus size={16} /> Invite Member
                </button>

                <button className="btn btn-primary" onClick={() => setTaskModalOpen(true)} style={{ width: 'auto', padding: '10px 16px' }}>
                  <Plus size={16} /> Add Task
                </button>
              </div>
            </header>

            {/* Kanban Columns */}
            <div className="board-columns">
              {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as TaskStatus[]).map((status) => {
                const tasks = getTasksByStatus(status);
                return (
                  <div key={status} className="board-column">
                    <div className="column-header">
                      <div className="column-title-wrap">
                        <span className={`column-dot ${status.toLowerCase().replace('_', '')}`} />
                        <h3>{status.replace('_', ' ')}</h3>
                      </div>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                        {tasks.length}
                      </span>
                    </div>

                    <div className="task-list">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="task-card glass-panel"
                          onClick={() => {
                            setSelectedTask(task);
                            setDetailModalOpen(true);
                          }}
                        >
                          <span className={`task-priority-badge ${task.priority.toLowerCase()}`}>
                            {task.priority}
                          </span>
                          <h4 className="task-title">{task.title}</h4>
                          <p className="task-desc">{task.description || 'No description'}</p>
                          
                          <div className="task-meta">
                            <span className="task-assignee">
                              <UserIcon size={12} />
                              {task.assignee ? task.assignee.name : 'Unassigned'}
                            </span>
                            {task.dueDate && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Calendar size={12} />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
            <Activity size={48} style={{ color: 'var(--color-primary)', marginBottom: 16 }} />
            <h3>No Active Project</h3>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 8, maxWidth: 360 }}>
              Create a project or select an existing one from the sidebar list to get started.
            </p>
          </div>
        )}
      </main>

      {/* Real-time Toast Alerts */}
      {realtimeAlert && (
        <div className="realtime-alert-banner">
          <Activity size={18} style={{ color: 'var(--color-secondary)' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{realtimeAlert}</div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', color: 'var(--color-text-muted)' }} onClick={() => setRealtimeAlert(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* MODAL: Create Project */}
      {projectModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <button className="modal-close" onClick={() => setProjectModalOpen(false)}><X size={20} /></button>
            <h3 style={{ fontSize: '1.5rem', marginBottom: 20 }}>Create New Project</h3>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Project Title</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Phoenix Platform v2"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="Summary of this project board..."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Create Project Board</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Member */}
      {memberModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <button className="modal-close" onClick={() => setMemberModalOpen(false)}><X size={20} /></button>
            <h3 style={{ fontSize: '1.5rem', marginBottom: 20 }}>Add Project Collaborator</h3>
            <form onSubmit={handleInviteMember}>
              <div className="form-group">
                <label>User Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="colleague@domain.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Add Member</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Task */}
      {taskModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <button className="modal-close" onClick={() => setTaskModalOpen(false)}><X size={20} /></button>
            <h3 style={{ fontSize: '1.5rem', marginBottom: 20 }}>Create New Task</h3>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g., Setup PostgreSQL migrations"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="Detailed breakdown of steps..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    className="form-input"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Assignee</label>
                  <select
                    className="form-input"
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {activeProject?.members?.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary">Create Task</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Task Details & AI Summarizer */}
      {detailModalOpen && selectedTask && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '680px' }}>
            <button className="modal-close" onClick={() => setDetailModalOpen(false)}><X size={20} /></button>
            
            <span className={`task-priority-badge ${selectedTask.priority.toLowerCase()}`}>
              {selectedTask.priority} Priority
            </span>

            <h3 style={{ fontSize: '1.8rem', margin: '8px 0 16px 0' }}>{selectedTask.title}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24, marginTop: 16 }}>
              {/* Left Column: Description & AI Summarizer */}
              <div>
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Description</h4>
                  <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#d1d5db', background: 'rgba(0,0,0,0.15)', padding: 16, borderRadius: 8, minHeight: '80px', maxHeight: '180px', overflowY: 'auto' }}>
                    {selectedTask.description || 'No description supplied.'}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>AI Summary Summary</h4>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => handleTriggerAiSummary(selectedTask.id)} 
                      disabled={aiGenerating}
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                    >
                      <Sparkles size={12} /> {aiGenerating ? 'Summarizing...' : 'Generate AI Summary'}
                    </button>
                  </div>

                  <div style={{ fontSize: '0.85rem', lineHeight: '1.5', background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.05) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(139, 92, 246, 0.15)', padding: 16, borderRadius: 8, minHeight: '140px', maxHeight: '240px', overflowY: 'auto' }}>
                    {selectedTask.aiSummary ? (
                      <div style={{ whiteSpace: 'pre-line' }}>{selectedTask.aiSummary}</div>
                    ) : (
                      <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', paddingTop: 30 }}>
                        <Sparkles size={24} style={{ color: 'var(--color-primary)', opacity: 0.5, marginBottom: 8 }} />
                        <p>No summary generated yet. Click "Generate AI Summary" to extract outline.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Metadata & Editors */}
              <div style={{ borderLeft: '1px solid var(--border-glass)', paddingLeft: 20 }}>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-input"
                    value={selectedTask.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as TaskStatus;
                      setSelectedTask({ ...selectedTask, status: newStatus });
                      updateTaskStatus(selectedTask.id, newStatus);
                    }}
                  >
                    <option value="TODO">Todo</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Assignee</label>
                  <select
                    className="form-input"
                    value={selectedTask.assigneeId || ''}
                    onChange={(e) => {
                      const newAssigneeId = e.target.value;
                      const matchedUser = activeProject.members?.find((m) => m.user.id === newAssigneeId)?.user;
                      
                      setSelectedTask({ 
                        ...selectedTask, 
                        assigneeId: newAssigneeId || undefined,
                        assignee: matchedUser ? { id: matchedUser.id, name: matchedUser.name, email: matchedUser.email } : undefined 
                      });
                      handleUpdateTaskDetail({ assigneeId: newAssigneeId || null });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {activeProject.members?.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={14} />
                    <span>Due: {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'No date set'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={14} />
                    <span>Created: {new Date(selectedTask.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <UserIcon size={14} />
                    <span>Creator: {selectedTask.creator ? selectedTask.creator.name : 'Unknown'}</span>
                  </div>
                </div>

                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleDeleteTaskClick(selectedTask.id)}
                  style={{ marginTop: 32, borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171', background: 'rgba(239, 68, 68, 0.05)' }}
                >
                  Delete Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
