-- Insert blueprint workflow templates for Emily's tenant
-- Tenant ID: 571af264-5d4d-4232-b94e-d1c2de323ff1

-- 1. Simple Two-Step Approval
INSERT INTO workflow_templates (id, tenant_id, name, description, steps, is_blueprint, version, is_active)
VALUES (
  'blueprint-simple-approval',
  '571af264-5d4d-4232-b94e-d1c2de323ff1',
  'Simple Two-Step Approval',
  'Basic approval workflow: Submit → Review → Approve/Reject',
  '[
    {
      "id": "start-1",
      "type": "start",
      "title": "Application Submitted",
      "position": {"x": 300, "y": 50},
      "transitions": [
        {
          "id": "trans-1",
          "targetStepId": "step-1",
          "label": "Start Review",
          "isDefault": true
        }
      ]
    },
    {
      "id": "step-1",
      "type": "step",
      "title": "Review Application",
      "role": "management_manager",
      "actions": ["approve", "reject"],
      "position": {"x": 300, "y": 200},
      "transitions": [
        {
          "id": "trans-2",
          "targetStepId": "end-1",
          "label": "Complete",
          "isDefault": true
        }
      ]
    },
    {
      "id": "end-1",
      "type": "end",
      "title": "Completed",
      "position": {"x": 300, "y": 350}
    }
  ]'::jsonb,
  true,
  1,
  true
) ON CONFLICT (id) DO NOTHING;

-- 2. Three-Step Review Workflow
INSERT INTO workflow_templates (id, tenant_id, name, description, steps, is_blueprint, version, is_active)
VALUES (
  'blueprint-three-step',
  '571af264-5d4d-4232-b94e-d1c2de323ff1',
  'Three-Step Review Process',
  'Management → Board → Final Decision',
  '[
    {
      "id": "start-2",
      "type": "start",
      "title": "Application Submitted",
      "position": {"x": 300, "y": 50},
      "transitions": [
        {
          "id": "trans-3",
          "targetStepId": "step-2",
          "isDefault": true
        }
      ]
    },
    {
      "id": "step-2",
      "type": "step",
      "title": "Management Review",
      "role": "management_manager",
      "actions": ["approve", "reject", "request_changes"],
      "position": {"x": 300, "y": 200},
      "transitions": [
        {
          "id": "trans-4",
          "targetStepId": "step-3",
          "label": "To Board",
          "isDefault": true
        }
      ]
    },
    {
      "id": "step-3",
      "type": "step",
      "title": "Board Review",
      "role": "poa_board_member",
      "actions": ["approve", "reject", "conditionally_approved"],
      "position": {"x": 300, "y": 350},
      "transitions": [
        {
          "id": "trans-5",
          "targetStepId": "end-2",
          "isDefault": true
        }
      ]
    },
    {
      "id": "end-2",
      "type": "end",
      "title": "Completed",
      "position": {"x": 300, "y": 500}
    }
  ]'::jsonb,
  true,
  1,
  true
) ON CONFLICT (id) DO NOTHING;

-- 3. Conditional Branch Workflow
INSERT INTO workflow_templates (id, tenant_id, name, description, steps, is_blueprint, version, is_active)
VALUES (
  'blueprint-conditional',
  '571af264-5d4d-4232-b94e-d1c2de323ff1',
  'Conditional Approval Path',
  'Different approval paths based on action',
  '[
    {
      "id": "start-3",
      "type": "start",
      "title": "Application Submitted",
      "position": {"x": 300, "y": 50},
      "transitions": [
        {
          "id": "trans-6",
          "targetStepId": "step-4",
          "isDefault": true
        }
      ]
    },
    {
      "id": "step-4",
      "type": "decision",
      "title": "Initial Review",
      "role": "management_manager",
      "actions": ["approve", "reject"],
      "position": {"x": 300, "y": 200},
      "transitions": [
        {
          "id": "trans-7",
          "targetStepId": "step-5",
          "label": "If Approved",
          "condition": {
            "type": "action",
            "action": "approve"
          }
        },
        {
          "id": "trans-8",
          "targetStepId": "end-3",
          "label": "If Rejected",
          "condition": {
            "type": "action",
            "action": "reject"
          }
        }
      ]
    },
    {
      "id": "step-5",
      "type": "step",
      "title": "Board Final Approval",
      "role": "poa_board_member",
      "actions": ["approve"],
      "position": {"x": 150, "y": 350},
      "transitions": [
        {
          "id": "trans-9",
          "targetStepId": "end-3",
          "isDefault": true
        }
      ]
    },
    {
      "id": "end-3",
      "type": "end",
      "title": "Completed",
      "position": {"x": 300, "y": 500}
    }
  ]'::jsonb,
  true,
  1,
  true
) ON CONFLICT (id) DO NOTHING;

-- 4. Multi-Path Workflow
INSERT INTO workflow_templates (id, tenant_id, name, description, steps, is_blueprint, version, is_active)
VALUES (
  'blueprint-multipath',
  '571af264-5d4d-4232-b94e-d1c2de323ff1',
  'Multi-Path Decision Tree',
  'Complex workflow with multiple decision points',
  '[
    {
      "id": "start-4",
      "type": "start",
      "title": "Application Submitted",
      "position": {"x": 400, "y": 50},
      "transitions": [
        {
          "id": "trans-10",
          "targetStepId": "step-6",
          "isDefault": true
        }
      ]
    },
    {
      "id": "step-6",
      "type": "decision",
      "title": "Screening Review",
      "role": "management_rep",
      "actions": ["proceed", "reject"],
      "position": {"x": 400, "y": 200},
      "transitions": [
        {
          "id": "trans-11",
          "targetStepId": "step-7",
          "label": "Proceed",
          "condition": {
            "type": "action",
            "action": "proceed"
          }
        },
        {
          "id": "trans-12",
          "targetStepId": "end-4",
          "label": "Reject",
          "condition": {
            "type": "action",
            "action": "reject"
          }
        }
      ]
    },
    {
      "id": "step-7",
      "type": "step",
      "title": "Detailed Review",
      "role": "management_manager",
      "actions": ["approve", "conditionally_approved", "reject"],
      "position": {"x": 250, "y": 350},
      "transitions": [
        {
          "id": "trans-13",
          "targetStepId": "step-8",
          "label": "Needs Board",
          "condition": {
            "type": "action",
            "action": "conditionally_approved"
          }
        },
        {
          "id": "trans-14",
          "targetStepId": "end-4",
          "label": "Final",
          "isDefault": true
        }
      ]
    },
    {
      "id": "step-8",
      "type": "step",
      "title": "Board Decision",
      "role": "poa_board_member",
      "actions": ["approve", "reject"],
      "position": {"x": 100, "y": 500},
      "transitions": [
        {
          "id": "trans-15",
          "targetStepId": "end-4",
          "isDefault": true
        }
      ]
    },
    {
      "id": "end-4",
      "type": "end",
      "title": "Completed",
      "position": {"x": 400, "y": 650}
    }
  ]'::jsonb,
  true,
  1,
  true
) ON CONFLICT (id) DO NOTHING;
