# Bug Report

## Bug 1: Pagination skips the first page

### Expected behavior
Pagination is 1-indexed. A request for `page=1&limit=2`
should return the first two tasks.

### Actual behavior
The implementation calculated the offset as:

`page * limit`

This caused page 1 to skip the first two tasks.

### How it was discovered
A unit test was written for `getPaginated(1, 2)` and expected
the first two tasks. The test failed against the original implementation.

### Fix
Changed the offset calculation to:

`(page - 1) * limit`

---

## Bug 2: Status filtering performs substring matching

### Expected behavior
`GET /tasks?status=done` should return tasks whose status is
exactly `done`.

### Actual behavior
The original implementation used substring matching:

`t.status.includes(status)`

This meant a partial value such as `do` could match `done`.

### How it was discovered
A unit test checked that a partial status such as `do` returns
an empty result.

### Fix
Changed the filter to exact equality:

`t.status === status`

---

## Bug 3: Completing a task changes its priority

### Expected behavior
Completing a task should change its status to `done` and set
`completedAt`, but should not modify unrelated fields such as priority.

### Actual behavior
The original implementation reset the task priority to `medium`
when completing a task.

### How it was discovered
A test created a high-priority task and then completed it.
The original implementation changed its priority to `medium`.

### Fix
Removed the hard-coded priority update from `completeTask`.

---

## Bug 4: PUT could overwrite protected task fields

### Expected behavior
Fields such as `id` and `createdAt` should remain immutable when
updating a task.

### Actual behavior
The original update implementation allowed arbitrary fields from
the request body to be merged into the task.

### How it was discovered
A test attempted to update `id` and `createdAt` and verified that
they remained unchanged.

### Fix
Added an explicit whitelist of fields allowed to be updated:

- title
- description
- status
- priority
- dueDate