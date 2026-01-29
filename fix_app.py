
import os

file_path = r'c:\Users\np05c\OneDrive - London Metropolitan University\IMPORTANT\3rd Year\FYP\project\ut-frontend\src\App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We know the broken section is around 667-709
start_index = -1
for i, line in enumerate(lines):
    if '(currentView === \'home\' || currentView === \'rooms\') && (' in line:
        start_index = i
        break

if start_index == -1:
    print("Could not find start of section")
    exit(1)

# Find where the corrupted section ends before the premium view
end_index = -1
for i in range(start_index + 1, len(lines)):
    if 'currentView === \'premium\' && (' in line: # No, this is wrong, I should check lines[i]
        pass
    if 'currentView === \'premium\' && (' in lines[i]:
        end_index = i
        break

if end_index == -1:
    print("Could not find end of section")
    exit(1)

# Backtrack to find the closing brace of the previous section
# The broken section ends with ) and then }
# Wait, let's just replace everything from start_index to end_index-1 but be careful

new_section = [
    '      {\n',
    '        (currentView === \'home\' || currentView === \'rooms\') && (\n',
    '          <div className="search-container">\n',
    '            <div className="search-bar-wrapper">\n',
    '              <input\n',
    '                type="text"\n',
    '                className="search-input"\n',
    '                placeholder="Search rooms by location, city, or address..."\n',
    '                value={searchQuery}\n',
    '                onChange={(e) => setSearchQuery(e.target.value)}\n',
    '              />\n',
    '              <button className="search-btn" aria-label="Search">\n',
    '                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">\n',
    '                  <circle cx="11" cy="11" r="8"></circle>\n',
    '                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>\n',
    '                </svg>\n',
    '              </button>\n',
    '            </div>\n',
    '\n',
    '            <div className="auth-buttons-header">\n',
    '              {isAdmin ? (\n',
    '                <>\n',
    '                  <span className="user-info admin-badge">⚡ Admin</span>\n',
    '                  <button className="ghost-cta mini" onClick={handleAdminLogout}>\n',
    '                    Logout\n',
    '                  </button>\n',
    '                </>\n',
    '              ) : user ? (\n',
    '                <>\n',
    '                  <span className="user-info">\n',
    '                    Hi, <span className="user-name-with-badge">\n',
    '                      {user.fullName.split(\' \')[0]}\n',
    '                      {user.isVerified && (\n',
    '                        <span className="verified-tick-icon">✓</span>\n',
    '                      )}\n',
    '                    </span>\n',
    '                  </span>\n',
    '                  <button className="ghost-cta mini" onClick={handleLogout}>\n',
    '                    Logout\n',
    '                  </button>\n',
    '                </>\n',
    '              ) : (\n',
    '                <>\n',
    '                  <button className="primary-cta compact" onClick={() => openModal(\'login\')}>\n',
    '                    Login\n',
    '                  </button>\n',
    '                  <button className="primary-cta compact light" onClick={() => openModal(\'signup\')}>\n',
    '                    Sign up\n',
    '                  </button>\n',
    '                </>\n',
    '              )}\n',
    '            </div>\n',
    '          </div>\n',
    '        )\n',
    '      }\n',
    '\n'
]

# The end_index is where "currentView === 'premium'" starts.
# We need to find how many lines before that we should remove.
# Based on view_file:
# 709:       }
# 710: 
# 711:             {
# 712:               currentView === 'premium' && (

final_end = -1
for i in range(end_index, start_index, -1):
    if '}' in lines[i]:
        final_end = i + 1
        break

if final_end == -1:
    final_end = end_index

lines[start_index-1:final_end] = new_section

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully updated App.tsx")
