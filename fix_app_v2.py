
import os

file_path = r'c:\Users\np05c\OneDrive - London Metropolitan University\IMPORTANT\3rd Year\FYP\project\ut-frontend\src\App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Add UserInquiry and update ModalView
for i, line in enumerate(lines):
    if "type ModalView = 'signup' | 'login' | 'register-room' | 'admin-verify' | null" in line:
        lines[i] = "type ModalView = 'signup' | 'login' | 'register-room' | 'admin-verify' | 'account' | null\n"
        # Insert interface before this line
        interface = [
            "interface UserInquiry {\n",
            "  id: number\n",
            "  room_id: number\n",
            "  room_title: string\n",
            "  sender_name: string\n",
            "  sender_email: string\n",
            "  sender_phone: string | null\n",
            "  message: string\n",
            "  created_at: string\n",
            "}\n",
            "\n"
        ]
        lines[i-1:i-1] = interface
        break

# 2. Insert Account Modal UI
# We look for the start of the else block for register-room
found_insertion = False
for i in range(len(lines)):
    if ") : (" in lines[i] and "Register a Room" in lines[i+4]: # Heuristic check
        account_ui = [
            "              ) : activeModal === 'account' && user ? (\n",
            "                <div className=\"account-modal-layout\">\n",
            "                  <section>\n",
            "                    <h3 className=\"account-section-title\">👤 Account Settings</h3>\n",
            "                    <form onSubmit={handleUpdateProfile} className=\"auth-form\" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>\n",
            "                      <div className=\"form-group\">\n",
            "                        <label className=\"auth-label\">Full Name</label>\n",
            "                        <input name=\"fullName\" defaultValue={user.fullName} required className=\"auth-input\" />\n",
            "                      </div>\n",
            "                      <div className=\"form-group\">\n",
            "                        <label className=\"auth-label\">Email Address</label>\n",
            "                        <input name=\"email\" type=\"email\" defaultValue={user.email} required className=\"auth-input\" />\n",
            "                      </div>\n",
            "                      <div className=\"form-group\">\n",
            "                        <label className=\"auth-label\">Phone Number</label>\n",
            "                        <input name=\"phoneNumber\" type=\"tel\" defaultValue={user.phoneNumber} required className=\"auth-input\" />\n",
            "                      </div>\n",
            "                      <div className=\"form-group\">\n",
            "                        <label className=\"auth-label\">New Password (Optional)</label>\n",
            "                        <input name=\"password\" type=\"password\" placeholder=\"Leave blank to keep current\" className=\"auth-input\" />\n",
            "                      </div>\n",
            "                      <button type=\"submit\" className=\"primary-cta\" style={{ gridColumn: 'span 2' }}>Update Profile</button>\n",
            "                    </form>\n",
            "                  </section>\n",
            "\n",
            "                  <section>\n",
            "                    <h3 className=\"account-section-title\">✉️ Room Inquiries</h3>\n",
            "                    {userInquiries.length === 0 ? (\n",
            "                      <p style={{ textAlign: 'center', color: '#9098b7', padding: '2rem' }}>No inquiries yet.</p>\n",
            "                    ) : (\n",
            "                      <div className=\"inquiry-grid\">\n",
            "                        {userInquiries.map(inq => (\n",
            "                          <div key={inq.id} className=\"inquiry-card\">\n",
            "                            <div className=\"inquiry-header\">\n",
            "                              <span className=\"inquiry-room-tag\">{inq.room_title}</span>\n",
            "                              <span>{new Date(inq.created_at).toLocaleDateString()}</span>\n",
            "                            </div>\n",
            "                            <div className=\"inquiry-sender\">{inq.sender_name}</div>\n",
            "                            <div className=\"inquiry-contact\">\n",
            "                              📧 {inq.sender_email} {inq.sender_phone && `| 📞 ${inq.sender_phone}`}\n",
            "                            </div>\n",
            "                            <div className=\"inquiry-message\">\"{inq.message}\"</div>\n",
            "                          </div>\n",
            "                        ))}\n",
            "                      </div>\n",
            "                    )}\n",
            "                  </section>\n",
            "                </div>\n"
        ]
        lines[i] = "".join(account_ui) + "              ) : (\n"
        found_insertion = True
        break

if not found_insertion:
    print("Failed to find insertion point for account UI")
else:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Successfully updated App.tsx")
