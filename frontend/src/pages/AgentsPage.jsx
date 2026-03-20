
import React, { useEffect, useReducer } from "react";
import { handleApiError } from '../lib/api/errors';
import { User, Mail, AlertCircle, Phone, X } from "lucide-react";
import { useAgentsQuery } from '../hooks/useAgents';
import { authService } from '../services/authService';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Card, { CardHeader, CardBody } from '../components/ui/Card';
import Input from '../components/ui/Input';

const emptyAgentForm = { name: '', email: '', phone: '', password: '' };

const initialState = {
  agentForm: emptyAgentForm,
  error: '',
  success: '',
  showModal: false,
  isCreating: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, agentForm: { ...state.agentForm, [action.field]: action.value } };
    case 'SET_ERROR':
      return { ...state, error: action.payload, success: '' };
    case 'SET_SUCCESS':
      return { ...state, success: action.payload, error: '' };
    case 'CLEAR_MESSAGES':
      return { ...state, error: '', success: '' };
    case 'OPEN_MODAL':
      return { ...state, showModal: true, agentForm: emptyAgentForm, error: '', success: '' };
    case 'CLOSE_MODAL':
      return { ...state, showModal: false, agentForm: emptyAgentForm, error: '', success: '' };
    case 'SET_CREATING':
      return { ...state, isCreating: action.payload };
    case 'RESET_FORM':
      return { ...state, agentForm: emptyAgentForm };
    default:
      return state;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AlertBanner({ message, type = 'error' }) {
  const styles = type === 'success'
    ? { background: '#d4edda', color: '#155724' }
    : { background: '#fee2e2', color: '#b91c1c' };

  return (
    <div style={{ padding: "1rem", borderRadius: "8px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", ...styles }}>
      <AlertCircle size={18} />
      {message}
    </div>
  );
}

function AgentFormField({ id, label, type = 'text', name, value, onChange, required, placeholder, minLength, autoComplete }) {
  return (
    <Input
      id={id}
      label={label}
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      minLength={minLength}
      autoComplete={autoComplete}
      style={{ marginBottom: "1rem" }}
    />
  );
}

function AgentRow({ agent }) {
  const statusTone = agent.isActive !== false ? 'active' : 'danger';
  const statusLabel = agent.isActive !== false ? 'Active' : 'Inactive';

  return (
    <tr>
      <td style={{ fontWeight: "500", color: "var(--text-primary)" }}>#{agent.id}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "var(--bg-color)", display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent-color)"
          }}>
            {agent.name ? agent.name.charAt(0).toUpperCase() : <User size={16} />}
          </div>
          <span style={{ fontWeight: "500" }}>{agent.name}</span>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Mail size={12} /> {agent.email}</span>
          {agent.phone && <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Phone size={12} /> {agent.phone}</span>}
        </div>
      </td>
      <td>
        <Badge variant={statusTone}>{statusLabel}</Badge>
      </td>
      <td>
        <Button variant="outline" size="sm">View Profile</Button>
      </td>
    </tr>
  );
}

function AgentsTable({ agents, loading }) {
  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
        Loading agents...
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
        No agents registered in the system.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Agent ID</th>
            <th>Name</th>
            <th>Contact Info</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddAgentModal({ isOpen, onClose, onSubmit, isCreating, form, onChange }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)",
      padding: "1rem",
    }}>
      <div style={{
        background: "var(--surface-color, #fff)",
        borderRadius: "16px",
        boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
        width: "min(480px, 100%)",
        maxHeight: "90vh",
        overflow: "auto",
      }}>
        {/* Modal Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
              Add New Agent
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Creates the user through the admin provisioning flow.
            </span>
            <button
              onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "0.25rem",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={onSubmit} style={{ padding: "1.5rem" }}>
          <AgentFormField
            id="agent-name"
            label="Full Name"
            type="text"
            name="name"
            value={form.name}
            onChange={onChange}
            required
            placeholder="Enter agent's full name"
            minLength={2}
          />

          <AgentFormField
            id="agent-email"
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            required
            placeholder="agent@example.com"
            autoComplete="email"
          />

          <AgentFormField
            id="agent-phone"
            label="Phone Number"
            type="tel"
            name="phone"
            value={form.phone}
            onChange={onChange}
            required
            placeholder="+57 300 123 4567"
            autoComplete="tel"
          />

          <AgentFormField
            id="agent-password"
            label="Temporary Password"
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            required
            placeholder="Minimum 6 characters"
            minLength={6}
            autoComplete="new-password"
          />

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create Agent"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function AgentsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const agentsQuery = useAgentsQuery();

  useEffect(() => {
    if (agentsQuery.error) {
      handleApiError(agentsQuery.error, (err) => dispatch({ type: 'SET_ERROR', payload: err.message || 'An error occurred' }));
    }
  }, [agentsQuery.error]);

  const agents = Array.isArray(agentsQuery.data?.data) ? agentsQuery.data.data : [];

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    dispatch({ type: 'SET_FIELD', field: name, value });
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    dispatch({ type: 'CLEAR_MESSAGES' });
    dispatch({ type: 'SET_CREATING', payload: true });

    try {
      await authService.adminRegister({
        name: state.agentForm.name,
        email: state.agentForm.email,
        password: state.agentForm.password,
        phone: state.agentForm.phone,
        role: 'agent',
      });

      dispatch({ type: 'SET_SUCCESS', payload: 'Agent created successfully!' });
      dispatch({ type: 'RESET_FORM' });
      await agentsQuery.refetch();

      setTimeout(() => {
        dispatch({ type: 'CLOSE_MODAL' });
      }, 1500);
    } catch (err) {
      handleApiError(err, (errMsg) => dispatch({ type: 'SET_ERROR', payload: errMsg }));
    } finally {
      dispatch({ type: 'SET_CREATING', payload: false });
    }
  };

  return (
    <div className="dashboard-page-stack fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">View and manage collection agents</p>
        </div>
        <Button
          onClick={() => dispatch({ type: 'OPEN_MODAL' })}
          icon={User}
        >
          Add New Agent
        </Button>
      </header>

      {state.error && <AlertBanner message={state.error} type="error" />}
      {state.success && <AlertBanner message={state.success} type="success" />}

      <Card>
        <CardHeader title="Registered Agents" />
        <CardBody className="p-0">
          <AgentsTable agents={agents} loading={agentsQuery.isLoading} />
        </CardBody>
      </Card>

      <AddAgentModal
        isOpen={state.showModal}
        onClose={() => dispatch({ type: 'CLOSE_MODAL' })}
        onSubmit={handleCreateAgent}
        isCreating={state.isCreating}
        form={state.agentForm}
        onChange={handleFormChange}
      />
    </div>
  );
}

export default AgentsPage;
