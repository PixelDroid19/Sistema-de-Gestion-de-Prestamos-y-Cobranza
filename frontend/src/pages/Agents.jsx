import React, { useEffect, useState } from 'react';
import { handleApiError } from '../lib/api/errors';
import { useAgentsQuery } from '../hooks/useAgents';

function Agents({ onSelect }) {
  const [error, setError] = useState('');
  const agentsQuery = useAgentsQuery();

  useEffect(() => {
    if (agentsQuery.error) {
      handleApiError(agentsQuery.error, setError);
    }
  }, [agentsQuery.error]);

  const agents = Array.isArray(agentsQuery.data?.data) ? agentsQuery.data.data : [];

  return (
    <div>
      <select 
        className="form-control" 
        onChange={e => onSelect(e.target.value)} 
        defaultValue=""
        style={{
          fontSize: '0.8rem',
          padding: '0.3rem 0.5rem',
          borderRadius: '4px',
          border: '1px solid #ced4da'
        }}
      >
        <option value="">Select Agent</option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name} ({agent.email})
          </option>
        ))}
      </select>
      {error && (
        <div style={{ 
          fontSize: '0.7rem', 
          color: '#dc3545', 
          marginTop: '0.25rem' 
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default Agents;
