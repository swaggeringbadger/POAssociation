-- Migration: Fix legacy workflow templates with missing structure
-- This migration updates workflow templates that were created before the visual
-- workflow designer was implemented. Legacy templates are missing:
--   - id field on each step
--   - type field on each step (start/step/end)
--   - position field on each step (x, y coordinates)
--   - transitions field on each step
--
-- This migration is idempotent - safe to run multiple times.

-- Function to migrate a single legacy workflow template
CREATE OR REPLACE FUNCTION migrate_legacy_workflow_steps(template_steps jsonb)
RETURNS jsonb AS $$
DECLARE
    result jsonb := '[]'::jsonb;
    step jsonb;
    new_step jsonb;
    step_index int := 0;
    total_steps int;
    step_id text;
    step_type text;
    next_step_id text;
BEGIN
    total_steps := jsonb_array_length(template_steps);

    FOR step_index IN 0..(total_steps - 1) LOOP
        step := template_steps->step_index;

        -- Skip if already has an id (already migrated)
        IF step->>'id' IS NOT NULL THEN
            result := result || jsonb_build_array(step);
            CONTINUE;
        END IF;

        -- Determine step type based on position and role
        IF step_index = 0 THEN
            step_type := 'start';
            step_id := 'start-' || gen_random_uuid()::text;
        ELSIF step_index = total_steps - 1 THEN
            step_type := 'end';
            step_id := 'end-' || gen_random_uuid()::text;
        ELSE
            step_type := 'step';
            step_id := 'step-' || gen_random_uuid()::text;
        END IF;

        -- Build the new step with required fields
        new_step := jsonb_build_object(
            'id', step_id,
            'type', step_type,
            'title', COALESCE(step->>'title', 'Step ' || (step_index + 1)),
            'position', jsonb_build_object('x', 300, 'y', 50 + (step_index * 150))
        );

        -- Add role if present and not system
        IF step->>'role' IS NOT NULL AND step->>'role' != 'system' THEN
            new_step := new_step || jsonb_build_object('role', step->>'role');
        END IF;

        -- Add actions if present and not empty
        IF step->'actions' IS NOT NULL AND jsonb_array_length(step->'actions') > 0 THEN
            -- Filter out 'proceed' action which was only for legacy system steps
            IF NOT (jsonb_array_length(step->'actions') = 1 AND step->'actions'->>0 = 'proceed') THEN
                new_step := new_step || jsonb_build_object('actions', step->'actions');
            END IF;
        END IF;

        -- Add description if present
        IF step->>'description' IS NOT NULL THEN
            new_step := new_step || jsonb_build_object('description', step->>'description');
        END IF;

        result := result || jsonb_build_array(new_step);
    END LOOP;

    -- Second pass: add transitions (now that we have all step IDs)
    FOR step_index IN 0..(jsonb_array_length(result) - 2) LOOP
        step := result->step_index;
        next_step_id := result->(step_index + 1)->>'id';

        -- Add transition to next step
        step := jsonb_set(
            step,
            '{transitions}',
            jsonb_build_array(
                jsonb_build_object(
                    'id', 'trans-' || gen_random_uuid()::text,
                    'targetStepId', next_step_id,
                    'label', CASE
                        WHEN step->>'type' = 'start' THEN 'Begin Review'
                        ELSE 'Continue'
                    END,
                    'isDefault', true
                )
            )
        );

        result := jsonb_set(result, ('{' || step_index || '}')::text[], step);
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Apply migration to all legacy templates (those without step IDs)
UPDATE workflow_templates
SET steps = migrate_legacy_workflow_steps(steps),
    updated_at = NOW()
WHERE steps->0->>'id' IS NULL
  AND jsonb_array_length(steps) > 0;

-- Log what was migrated
DO $$
DECLARE
    migrated_count int;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM workflow_templates
    WHERE steps->0->>'id' IS NOT NULL
      AND updated_at > NOW() - INTERVAL '1 minute';

    RAISE NOTICE 'Migrated % legacy workflow templates', migrated_count;
END $$;

-- Clean up the function (optional - keep if you want to use it again)
DROP FUNCTION IF EXISTS migrate_legacy_workflow_steps(jsonb);

-- Verify migration was successful
DO $$
DECLARE
    bad_count int;
BEGIN
    SELECT COUNT(*) INTO bad_count
    FROM workflow_templates wt,
         jsonb_array_elements(wt.steps) as step_elem
    WHERE step_elem->>'id' IS NULL;

    IF bad_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % steps still missing IDs', bad_count;
    END IF;

    RAISE NOTICE 'Migration verification passed: all steps have IDs';
END $$;
