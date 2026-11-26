import assert from 'node:assert/strict'
import { register } from 'node:module'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

register('./esm-extension-loader.mjs', pathToFileURL('./scripts/'))

const {
  buildLeadWizardData,
  buildMoveDetailsWizard,
  buildQuoteExtrasWizard,
  mergeLeadEditsIntoQuoteDetails,
  mergePriceNoteIntoSpecialInstructions,
  notesForCustomerEmail,
  quoteExtrasFormFromLead,
} = await import('../customerLeadMoveSync.js')

test('a price note becomes the special instruction and is written on the booking', () => {
  assert.equal(mergePriceNoteIntoSpecialInstructions('', 'Call before 8am'), 'Call before 8am')
  assert.equal(
    mergePriceNoteIntoSpecialInstructions('Park on the left', 'Call before 8am'),
    'Park on the left\nCall before 8am',
  )
  assert.equal(
    mergePriceNoteIntoSpecialInstructions('Old note', 'New note', 'Old note'),
    'New note',
  )

  const details = mergeLeadEditsIntoQuoteDetails('Converted from customer lead by admin.', {
    specialInstructions: 'Call before 8am',
    priceNote: 'Agreed on the phone',
    inventoryLines: [{ name: 'Double bed', quantity: 1, m3: 1.4 }],
  })

  assert.match(details, /Customer notes: Call before 8am/)
  assert.match(details, /Price override reason: Agreed on the phone/)
  assert.match(details, /Inventory:\n- 1× Double bed/)
})

test('editing the list replaces the old items on an existing booking', () => {
  const before = [
    'Customer notes: Old note',
    'Price override reason: First price',
    'Inventory:',
    '- 2× Sofa (2 m³)',
    '',
    'Crew: 2',
  ].join('\n')

  const details = mergeLeadEditsIntoQuoteDetails(before, {
    specialInstructions: 'Use the side door',
    priceNote: 'Second price',
    inventoryLines: [{ name: 'King size bed', quantity: 1, m3: 1.7 }],
  })

  assert.match(details, /Customer notes: Use the side door/)
  assert.match(details, /Price override reason: Second price/)
  assert.match(details, /- 1× King size bed/)
  assert.doesNotMatch(details, /Sofa/)
  assert.match(details, /Crew: 2/)
})

test('the email can tell a customer note from an admin note', () => {
  const customerOnly = notesForCustomerEmail({
    wizard_data: { step3: { specialInstructions: 'Park on the left' } },
  })
  assert.deepEqual(customerOnly, { customer: 'Park on the left', admin: '' })

  const withPriceNote = notesForCustomerEmail({
    price_override_reason: 'Call before 8am',
    wizard_data: { step3: { specialInstructions: 'Park on the left\nCall before 8am' } },
  })
  assert.deepEqual(withPriceNote, { customer: 'Park on the left', admin: 'Call before 8am' })

  const edited = buildLeadWizardData(
    {
      price_override_reason: 'Call before 8am',
      wizard_data: { step3: { specialInstructions: 'Park on the left\nCall before 8am' } },
    },
    {
      inventoryLines: [],
      specialInstructions: 'Use the side door',
      instructionsAuthor: 'admin',
    },
  )
  assert.equal(edited.wizard_data.step3.customerSpecialInstructions, 'Park on the left')
  assert.equal(edited.wizard_data.step3.specialInstructionsSource, 'admin')
  assert.deepEqual(notesForCustomerEmail({ ...edited, price_override_reason: 'Call before 8am', wizard_data: edited.wizard_data }), {
    customer: 'Park on the left',
    admin: 'Use the side door\nCall before 8am',
  })
})

test('move details keep the distance and the customer note, and ground floor has no lift', () => {
  const built = buildMoveDetailsWizard(
    {
      service_type: 'House Removals',
      wizard_data: {
        step1: { pickupAddress: '1 High Street', deliveryAddress: '2 Low Road', pickupFloor: 0, distanceMiles: 12 },
        step3: { specialInstructions: 'Park on the left' },
      },
    },
    {
      serviceType: 'Man with Van',
      pickupAddress: '10 New Street',
      deliveryAddress: '2 Low Road',
      pickupPropertyType: 'Flat / apartment',
      deliveryPropertyType: 'House',
      pickupFloor: '2',
      pickupLift: 'yes',
      deliveryFloor: '0',
      deliveryLift: 'yes',
      moveDate: '2026-12-01',
      arrivalWindow: 'morning',
      exactArrivalTime: '',
      flexibleArrivalFrom: '',
      flexibleArrivalUntil: '',
    },
  )
  assert.equal(built.wizard_data.step1.pickupFloor, 2)
  assert.equal(built.wizard_data.step1.pickupLift, true)
  assert.equal(built.wizard_data.step1.deliveryLift, null)
  assert.equal(built.wizard_data.step1.distanceMiles, 12)
  assert.equal(built.wizard_data.step1.arrivalSummary, 'Morning · 08:00–12:00')
  assert.equal(built.wizard_data.step3.selectedMoveDate, '2026-12-01')
  assert.equal(built.wizard_data.step3.specialInstructions, 'Park on the left')
  assert.equal(built.service_type, 'Man with Van')
  assert.equal(built.pickup_address, '10 New Street')
  assert.equal(Object.hasOwn(built, 'agreed_price'), false)
})

test('turning materials off removes the boxes we supply and keeps the customer items', () => {
  const lead = {
    wizard_data: {
      step1: { moveDate: '2026-12-01' },
      step2: {
        inventoryLines: [
          { lineId: 'sofa', name: 'Sofa', quantity: 1, m3: 2 },
          {
            lineId: 'supplied-box:smallBoxes',
            name: 'Small moving box (Boxes supplied by us)',
            quantity: 4,
            m3: 0.05,
            suppliedByUs: true,
          },
        ],
      },
      step3: { packingMaterials: true, packingMaterialsDetail: 'Small moving box: 4 boxes', specialInstructions: 'Park on the left' },
    },
  }
  const cleared = buildQuoteExtrasWizard(lead, {
    ...quoteExtrasFormFromLead(lead),
    packingMaterials: false,
  })
  assert.deepEqual(
    cleared.wizard_data.step2.inventoryLines.map((line) => line.name),
    ['Sofa'],
  )
  assert.equal(cleared.wizard_data.step3.specialInstructions, 'Park on the left')

  const added = buildQuoteExtrasWizard(lead, {
    ...quoteExtrasFormFromLead(lead),
    packingMaterials: true,
    packingMaterialsDetail: 'Medium moving box: 2 boxes',
  })
  const supplied = added.wizard_data.step2.inventoryLines.find((line) => line.suppliedByUs)
  assert.equal(supplied.name, 'Medium moving box (Boxes supplied by us)')
  assert.equal(supplied.quantity, 2)
  assert.equal(added.lines[0].name, 'Sofa')
})
