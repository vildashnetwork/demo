# Python script to add new fields to SchoolClass.js
with open('backend/models/SchoolClass.js', 'r', encoding='utf-8') as f:
    content = f.read()

# New fields to insert
new_fields = """
    // One amount per tuition installment (e.g. [20000, 20000, 20000] for 3 installments of 60000)
    tuitionInstallmentAmounts: {
      type: [Number],
      default: []
    },
    // Registration requirements (e.g. ["Uniform", "Exercise books", "ID card"])
    registrationRequirements: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true, trim: true },
        },
      ],
      default: []
    },
"""

marker1 = 'registrationFeeAmount: {'
marker2 = '    isActive: {'

idx1 = content.find(marker1)
idx2 = content.find(marker2)

# Replace the block
result = content[:idx1] + new_fields + content[idx2:]

with open('backend/models/SchoolClass.js', 'w', encoding='utf-8') as f:
    f.write(result)

print('SUCCESS')
