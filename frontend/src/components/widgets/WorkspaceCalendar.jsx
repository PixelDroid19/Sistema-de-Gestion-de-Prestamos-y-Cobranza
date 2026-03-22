import React from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS, es } from 'date-fns/locale'

const locales = {
  en: enUS,
  es,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

function WorkspaceCalendar({ culture = 'es', messages = {}, ...props }) {
  return (
    <div className="lf-calendar">
      <Calendar
        localizer={localizer}
        culture={culture}
        messages={{
          next: culture === 'es' ? 'Sig' : 'Next',
          previous: culture === 'es' ? 'Ant' : 'Prev',
          today: culture === 'es' ? 'Hoy' : 'Today',
          month: culture === 'es' ? 'Mes' : 'Month',
          week: culture === 'es' ? 'Semana' : 'Week',
          day: culture === 'es' ? 'Dia' : 'Day',
          agenda: culture === 'es' ? 'Agenda' : 'Agenda',
          ...messages,
        }}
        {...props}
      />
    </div>
  )
}

export default WorkspaceCalendar
