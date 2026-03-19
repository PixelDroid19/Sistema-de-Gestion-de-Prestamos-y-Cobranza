
import React, { useEffect, useState } from "react";
import { handleApiError } from '../lib/api/errors';
import { User, Mail, AlertCircle, Phone } from "lucide-react";
import { useAgentsQuery } from '../hooks/useAgents';

function AgentsPage() {
  const [error, setError] = useState("");
  const agentsQuery = useAgentsQuery();

  useEffect(() => {
    if (agentsQuery.error) {
      handleApiError(agentsQuery.error, setError);
    }
  }, [agentsQuery.error]);

  const agents = Array.isArray(agentsQuery.data?.data) ? agentsQuery.data.data : [];
  const loading = agentsQuery.isLoading;

  return (
    <div className="dashboard-page-stack fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">View and manage collection agents</p>
        </div>
        <button className="primary-button" style={{display: "flex", gap: "0.5rem", alignItems: "center"}}>
          <User size={16} /> Add New Agent
        </button>
      </header>

      {error && (
        <div style={{ padding: "1rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "8px", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="surface-card">
        <div className="surface-card__header">
          <h2 className="surface-card__title">Registered Agents</h2>
        </div>
        <div className="surface-card__content" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>
              Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
              No agents registered in the system.
            </div>
          ) : (
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
                    <tr key={agent.id}>
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
                        <span className="status-badge status-badge--active">Active</span>
                      </td>
                      <td>
                         <button style={{
                           padding: "0.4rem 0.75rem",
                           borderRadius: "6px",
                           border: "1px solid var(--border-color)",
                           background: "transparent",
                           color: "var(--text-secondary)",
                           cursor: "pointer",
                           fontSize: "0.8rem"
                         }}>View Profile</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentsPage;

