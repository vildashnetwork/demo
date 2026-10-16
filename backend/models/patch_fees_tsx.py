# Python script to update Fees.tsx with requirement toggles
with open('frontend/src/pages/Fees.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

modified = False

# 1. Add requirements header to thead
old_action_header = '<th className="px-3 py-3 text-right xl:px-5">Action</th>'
new_action_header = '<th className="px-3 py-3 text-right xl:px-5">Requirement Check</th>\n                  <th className="px-3 py-3 text-right xl:px-5">Action</th>'

if old_action_header in content:
    content = content.replace(old_action_header, new_action_header, 1)
    modified = True
    print('SUCCESS: Added requirements header')
else:
    print('FAILED: could not find action header')

# 2. Update row destructuring to include requirementChecks and checkMap
old_destructure = 'visibleRows.map(({ student: s, classObj, plan, status, statusColor, hasPayment }) => ('
new_destructure = 'visibleRows.map(({ student: s, classObj, plan, status, statusColor, hasPayment, requirementChecks, checkMap }) => ('

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure, 1)
    modified = True
    print('SUCCESS: Updated row destructuring')
else:
    print('FAILED: could not find destructuring')

# 3. Add requirement toggle cells after the Action button div closes
old_action_cell_end = '''                          </button>
                        </div>
                      </td>
                    </tr>'''

new_requirement_cells = '''                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {classObj?.registrationRequirements.map((req) => (
                            <label key={req.id} className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={checkMap.get(req.id) || false}
                                onChange={() => toggleRequirementCheck(s.id, req.id)}
                                className="size-3.5 accent-blue-700"
                              />
                              <span className={checkMap.get(req.id) ? 'text-brand' : 'text-black/60'}>{req.label}</span>
                            </label>
                          ))}
                          {classObj?.registrationRequirements.length === 0 && (
                            <span className="text-xs text-black/30">No requirements</span>
                          )}
                          <span className="text-[10px] text-black/30 ml-1">({getRequirementsMet(s.id, classObj)}/{classObj?.registrationRequirements.length || 0})</span>
                        </div>
                      </td>
                    </tr>'''

if old_action_cell_end in content:
    content = content.replace(old_action_cell_end, new_requirement_cells, 1)
    modified = True
    print('SUCCESS: Added requirement toggle cells')
else:
    print('FAILED: could not find action cell end')
    # Show what we have around that area
    idx = content.find('</div>\n                      </td>\n                    </tr>')
    if idx != -1:
        print(repr(content[idx-200:idx+200]))

if modified:
    with open('frontend/src/pages/Fees.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('ALL CHANGES WRITTEN TO FILE')
else:
    print('NO CHANGES MADE')
