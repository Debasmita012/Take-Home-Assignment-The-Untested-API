# Submission Notes

## What I would test next

If I had more time, I would add tests for:

- Invalid pagination values such as negative page/limit values
- Very large pagination values
- Boundary cases around due dates
- Repeated completion of an already completed task
- Concurrent requests that modify the same task
- Additional malformed request bodies
- API behavior with unexpected HTTP methods

## What surprised me

The main surprises were that several issues were not obvious from
reading the endpoint descriptions alone. Writing behavior-focused
tests exposed an off-by-one pagination bug, substring-based status
filtering, and an unrelated priority change when completing a task.

I also found that the update operation could overwrite fields that
should normally be treated as immutable, such as the task ID and
creation timestamp.

## Questions I would ask before shipping to production

- Should an already assigned task be allowed to be reassigned?
- Should pagination reject invalid or negative values instead of
  falling back to defaults?
- Should completed tasks be allowed to be edited?
- What authentication and authorization rules should protect the API?
- What persistence/database should replace the in-memory store?
- What validation and limits should apply to descriptions and other
  task fields?
- What logging and monitoring requirements are expected in production?
- What API response/error format should be standardized?

## Assignment feature decision

For `PATCH /tasks/:id/assign`, I chose to allow reassignment.

If a task is already assigned, a new valid assignee replaces the
previous assignee. This keeps the endpoint useful for correcting or
transferring ownership while still validating that the new assignee
is a non-empty string.