import { useEffect, useState } from 'react'

import { useAgentsQuery } from '@/hooks/useAgents'
import { handleApiError } from '@/lib/api/errors'

function AgentsSelect({ onSelect }) {
  const [error, setError] = useState('')
  const agentsQuery = useAgentsQuery()

  useEffect(() => {
    if (agentsQuery.error) {
      handleApiError(agentsQuery.error, setError)
    }
  }, [agentsQuery.error])

  const agents = Array.isArray(agentsQuery.data?.data) ? agentsQuery.data.data : []

  return (
    <div>
      <select className="form-control" onChange={(event) => onSelect(event.target.value)} defaultValue="">
        <option value="">Select agent</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name} ({agent.email})
          </option>
        ))}
      </select>
      {error ? <div style={{ marginTop: '0.3rem', color: 'var(--danger-color)', fontSize: '0.75rem' }}>{error}</div> : null}
    </div>
  )
}

export default AgentsSelect
