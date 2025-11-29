-- Add versioning and blueprint support to workflow templates

-- Add versioning columns to workflow_templates
ALTER TABLE workflow_templates
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN parent_template_id VARCHAR REFERENCES workflow_templates(id),
  ADD COLUMN is_blueprint BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN created_by_user_id VARCHAR REFERENCES users(id);

-- Add index for template lookups
CREATE INDEX idx_workflow_templates_blueprint ON workflow_templates(is_blueprint);
CREATE INDEX idx_workflow_templates_parent ON workflow_templates(parent_template_id);

-- Mark existing seed templates as blueprints
-- We'll identify them by checking if they were created by system (created_by_user_id IS NULL)
UPDATE workflow_templates
SET is_blueprint = true
WHERE created_by_user_id IS NULL;

-- Add comment explaining versioning strategy
COMMENT ON COLUMN workflow_templates.version IS 'Version number for this template (increments on save as new version)';
COMMENT ON COLUMN workflow_templates.parent_template_id IS 'Reference to parent template if this was cloned';
COMMENT ON COLUMN workflow_templates.is_blueprint IS 'True for system templates that can be cloned but not edited';
COMMENT ON COLUMN workflow_templates.created_by_user_id IS 'User who created this template (NULL for system templates)';
