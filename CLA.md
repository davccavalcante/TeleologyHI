# Contributor License Agreement (CLA) — TeleologyHI

By submitting a contribution (a pull request, patch, or any other form of
material) to this repository, You — the contributor — agree to the terms
below.

Two paths are accepted; pick **one** by following the workflow described
in §3.

---

## 1. The DCO path (default — preferred for most contributions)

Every commit in your pull request must end with a `Signed-off-by` trailer:

```
Signed-off-by: Your Name <your.email@example.com>
```

Add it automatically by passing `-s` to `git commit`. The signature
asserts the **Developer Certificate of Origin v1.1** ([developercertificate.org](https://developercertificate.org/)):

> By making a contribution to this project, I certify that:
>
> (a) The contribution was created in whole or in part by me and I have
>     the right to submit it under the open source license indicated in
>     the file; or
>
> (b) The contribution is based upon previous work that, to the best of
>     my knowledge, is covered under an appropriate open source license
>     and I have the right under that license to submit that work with
>     modifications, whether created in whole or in part by me, under
>     the same open source license (unless I am permitted to submit
>     under a different license), as indicated in the file; or
>
> (c) The contribution was provided directly to me by some other person
>     who certified (a), (b) or (c) and I have not modified it.
>
> (d) I understand and agree that this project and the contribution are
>     public and that a record of the contribution (including all
>     personal information I submit with it, including my sign-off) is
>     maintained indefinitely and may be redistributed consistent with
>     this project and the open source license(s) involved.

The DCO is sufficient for individual contributions, small bug fixes,
documentation improvements, and tests.

---

## 2. The signed-CLA path (required for substantive features)

If your contribution adds a new public surface, changes a core invariant
(MAIC's signature gate, the HIM identity model, the NHE refusal pipeline,
the audit log's tamper-evidence guarantees), or adds a third-party
dependency, you additionally agree to the following:

1. **License grant.** You grant David C. Cavalcante (the "Project Owner")
   and recipients of software distributed by the Project Owner a
   perpetual, worldwide, non-exclusive, no-charge, royalty-free,
   irrevocable license to reproduce, prepare derivative works of,
   publicly display, publicly perform, sublicense, and distribute Your
   Contribution and such derivative works under the **Apache License,
   Version 2.0** (the project's code license).

2. **Patent grant.** You grant the Project Owner and recipients a
   perpetual, worldwide, non-exclusive, no-charge, royalty-free,
   irrevocable patent license to make, have made, use, offer to sell,
   sell, import, and otherwise transfer the Contribution, where such
   license applies only to those patent claims licensable by You that
   are necessarily infringed by Your Contribution alone or by
   combination of Your Contribution with the Project. If any entity
   institutes patent litigation against You or any other entity
   (including a cross-claim or counterclaim in a lawsuit) alleging that
   the Project or a Contribution incorporated within the Project
   constitutes direct or contributory patent infringement, then any
   patent licenses granted to that entity under this CLA for that
   Contribution shall terminate as of the date such litigation is
   filed.

3. **Trademarks.** This CLA does NOT grant rights to the **MAIC™**,
   **HIM™**, **NHE™**, **TeleologyHI™**, or **Takk™** trademarks. See
   [`TRADEMARK.md`](./TRADEMARK.md) for the separate trademark policy.

4. **Original work.** You represent that the Contribution is Your
   original work, or You have all necessary rights to make the
   Contribution and the grants above. If Your employer has rights to
   intellectual property You create, You represent that You have
   received permission to make the Contribution on behalf of that
   employer, or that Your employer has waived such rights for the
   Contribution.

5. **No support obligation.** You are not expected to provide support
   for Your Contribution, except as You may decide on a voluntary basis.

To agree to this path, sign-off your commits per §1 **and** open the
pull request with the title prefix `[CLA-signed]`. The Project Owner will
respond with the canonical sign-off block to be appended to the PR
description before merge.

---

## 3. Workflow

1. Fork the repository at
   [`github.com/davccavalcante/TeleologyHI`](https://github.com/davccavalcante/TeleologyHI).
2. Make your changes in a feature branch.
3. Run `npm install && npm test && npm run lint` locally — the workspace
   matrix must stay green.
4. Sign-off each commit (`git commit -s`).
5. If your contribution falls under §2, also prefix the PR title with
   `[CLA-signed]` and re-paste the relevant §2 paragraphs in the PR body
   as evidence of consent.
6. Open the pull request against `main`.

---

## 4. Notes

- This document does NOT supersede the Apache 2.0 license; it adds the
  contributor-side agreement that lets the Project Owner re-license, sub-
  license, or dual-license the code base in the future without re-asking
  every contributor.
- Contributions that do not include a valid DCO sign-off (and the §2
  block where required) will be requested to amend before review.
- Open questions about the CLA itself: open a discussion or email
  **davcavalcante@proton.me** (or **say@takk.ag**) with subject `[CLA]`.

---

Signed by the Project Owner:

> **David C. Cavalcante** — 2026-05-16
