const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'ut-frontend', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const bookingsTabContent = `
                    {adminActiveTab === 'bookings' && (
                      <div className="admin-section">
                        <h3>All Booking Requests</h3>
                        <div className="admin-table-container">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Room</th>
                                <th>User</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminBookings.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                    No bookings found
                                  </td>
                                </tr>
                              ) : (
                                adminBookings.map((b) => (
                                  <tr key={b.id}>
                                    <td>{b.id}</td>
                                    <td>{b.room_title}</td>
                                    <td>{b.user_name}</td>
                                    <td>
                                      {new Date(b.check_in_date).toLocaleDateString()} - {new Date(b.check_out_date).toLocaleDateString()}
                                    </td>
                                    <td>
                                      <span className={\`status-badge status-\${b.status}\`}>
                                        {b.status}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="admin-actions">
                                        {b.status === 'pending' && (
                                          <>
                                            <button
                                              className="admin-btn verify-btn"
                                              onClick={() => handleUpdateBookingStatus(b.id, 'approved')}
                                            >
                                              Approve
                                            </button>
                                            <button
                                              className="admin-btn unverify-btn"
                                              onClick={() => handleUpdateBookingStatus(b.id, 'rejected')}
                                            >
                                              Reject
                                            </button>
                                          </>
                                        )}
                                        {b.status !== 'cancelled' && b.status !== 'pending' && (
                                          <button
                                            className="admin-btn delete-btn-admin"
                                            onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                                          >
                                            Cancel
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}`;

// Find the insertion point: after the closing of adminActiveTab === 'rooms' block
const roomsBlockEnd = "adminActiveTab === 'rooms' && (\\s*<div className=\"admin-section\">[\\s\\S]*?</div>\\s*\\)\\s*\\)";
const regex = new RegExp(roomsBlockEnd);
const match = content.match(regex);

if (match) {
    const endPos = match.index + match[0].length;
    content = content.slice(0, endPos) + bookingsTabContent + content.slice(endPos);
    console.log('Inserted admin bookings tab content');
} else {
    console.log('Could not find rooms block end');
}

// Also update bookingMessage UI
content = content.replace(
    /\{bookingMessage && \(\s*<div className={`form-feedback-simple \$\{bookingMessage\.type\}`}>\s*\{bookingMessage\.text\}\s*<\/div>\s*\)\}/g,
    `{bookingMessage && (
                      <div className={\`form-feedback-premium \${bookingMessage.type}\`}>
                        {bookingMessage.type === 'success' ? '✅' : '❌'} {bookingMessage.text}
                      </div>
                    )}`
);

fs.writeFileSync(filePath, content);
console.log('App.tsx updated successfully');
