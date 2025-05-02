const form = document.getElementById('taskForm');
const tableBody = document.querySelector('#taskTable tbody');

let rowCounter = 1;

// Convert 24-hour time to AM/PM
function formatTimeToAMPM(timeStr) {
  if (!timeStr) return '';
  const [hour, minute] = timeStr.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Utility to get either normalized or legacy key
function getValue(data, ...keys) {
  for (let key of keys) {
    if (data[key]) return data[key];
  }
  return '';
}

// Add a row to the task table
function addTaskToTable(taskData) {
  const row = tableBody.insertRow();

  const values = [
    rowCounter++,
    getValue(taskData, 'task', 'Task'),
    getValue(taskData, 'status', 'Status'),
    formatTimeToAMPM(getValue(taskData, 'start_time', 'start time')),
    formatTimeToAMPM(getValue(taskData, 'end_time', 'end time')),
    getValue(taskData, 'start_date', 'start date'),
    getValue(taskData, 'end_date', 'end date')
  ];

  values.forEach(text => {
    const cell = row.insertCell();
    cell.textContent = text || '';
  });

  const actionCell = row.insertCell();
  const status = getValue(taskData, 'status', 'Status');

  if (status === "pending") {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "status-checkbox";
    checkbox.title = "Mark as completed";

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        updateTaskStatus(row, taskData);
      }
    });

    actionCell.appendChild(checkbox);
  } else {
    actionCell.innerHTML = "✔️";
  }
}

// Update status to completed
function updateTaskStatus(row, taskData) {
  // Strict normalization for Google Sheet compatibility
  const updatedData = {
    task: taskData.task || taskData.Task || '',
    status: 'completed',
    start_time: taskData.start_time || taskData["start time"] || '',
    end_time: taskData.end_time || taskData["end time"] || '',
    start_date: taskData.start_date || taskData["start date"] || '',
    end_date: taskData.end_date || taskData["end date"] || ''
  };

  // Abort if required fields are missing
  if (!updatedData.task || !updatedData.start_time || !updatedData.end_time) {
    alert("Missing required fields. Cannot update.");
    console.error("Invalid update payload:", updatedData);
    return;
  }

  // Send to update webhook
  fetch('http://localhost:5678/webhook/update-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedData)
  }).then(res => {
    if (res.ok) {
      row.cells[2].textContent = "completed";   // update status column
      row.cells[7].innerHTML = "✔️";            // replace checkbox with checkmark
    } else {
      alert("Failed to update status on the server.");
      console.error("Update failed:", res.statusText);
    }
  }).catch(err => {
    alert("Network error. Make sure n8n is running.");
    console.error("Fetch error:", err);
  });
}



// Load tasks on page load
window.addEventListener('DOMContentLoaded', () => {
  fetch('http://localhost:5678/webhook/save-task')
    .then(res => {
      if (!res.ok) throw new Error("GET request failed");
      return res.json();
    })
    .then(data => {
      console.log("Fetched tasks:", data);
      if (Array.isArray(data)) {
        data.forEach(task => {
          // ✅ Skip blank objects
          if (Object.keys(task).length > 0) {
            addTaskToTable(task);
          }
        });
      } else {
        console.warn("Expected array, got:", data);
      }
    })
    
    .catch(err => {
      console.error("Failed to load tasks:", err);
    });
});

// Submit form to create new task
form.addEventListener('submit', function (e) {
  e.preventDefault();

  const task = form.task.value.trim();
  const startTime = form.start_time.value;
  const endTime = form.end_time.value;
  const startDate = form.start_date.value;
  const endDate = form.end_date.value;

  if (!task || !startTime || !endTime || !startDate || !endDate) {
    alert("Please complete all fields before submitting.");
    return;
  }

  const taskData = {
    task: task,
    status: "pending", // force as pending
    start_time: startTime,
    end_time: endTime,
    start_date: startDate,
    end_date: endDate
  };

  addTaskToTable(taskData);

  fetch('http://localhost:5678/webhook/save-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });

  form.reset();
});
