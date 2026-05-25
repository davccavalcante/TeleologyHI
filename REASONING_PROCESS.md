# REASONING PROCESSES IN LLMs (2026)

## Documented Internal Processes in LLM Operations

This document lists every reasoning process and internal operation that occurs while executing Large Language Models (Claude, ChatGPT, Grok, Gemini, etc.), as documented in the 2026 Prompt Engineering reference guide.

---

## FUNDAMENTAL PROCESSES

### 1. Thought
- The model's base internal reasoning process
- Used in ReAct: Thought -> Action -> Observation -> Repeat
- Represents the cognitive process before output or action generation

### 2. Action
- Execution of operations or calls to external tools
- Part of the ReAct cycle after the Thought
- Can include: web search, code execution, API calls

### 3. Observation
- Processing of executed action results
- Feedback loop in the ReAct pattern
- Informs the next Thought cycle

---

## STRUCTURED REASONING PROCESSES

### 4. Chain-of-Thought (CoT)
- Explicit step-by-step reasoning
- Linear sequential thought process
- Produces intermediate steps before the final answer

### 5. Zero-Shot CoT
- Step-by-step reasoning without prior examples
- Triggered by phrases such as "Let's think step by step"
- Automatic problem-decomposition process

### 6. Tree-of-Thoughts (ToT)
- Exploration of multiple reasoning paths in a tree structure
- Parallel branch-evaluation processes
- Selection of the optimal path among alternatives

### 7. Graph-of-Thought (GoT)
- Reasoning in a graph structure with directed dependencies
- Operators: Generate, Aggregate, Improve, Score
- Information reuse between graph nodes

### 8. Thread-of-Thought (ThoT)
- Continuous and evolving reasoning across multiple interactions
- Maintenance of cumulative context
- Process: Decomposition -> Individual analysis -> Final synthesis

### 9. Skeleton-of-Thought (SoT)
- Skeleton/structure generation before detail
- Structural planning process
- Enables parallelisation of content generation

### 10. Sketch-of-Thought
- Reasoning with cognitive paradigms and linguistic constraints
- Token minimisation while maintaining precision
- Process optimised for limited resources

### 11. Chain-of-Symbol (CoS)
- Reasoning with condensed symbols instead of natural language
- Symbolic abstraction process
- Optimised for spatial tasks

---

## DECOMPOSITION PROCESSES

### 12. Decomposed Prompting
- Breaking problems into modular subtasks
- Processes: sequential, recursive, parallel
- Specialised handlers per subtask

### 13. Least-to-Most (LtM)
- Incremental decomposition from simple to complex
- Construction in layers of increasing complexity
- Hierarchical resolution process

### 14. Successive Prompting
- Iterative refinement through stages
- Adaptation at each iteration
- Staged process of progressive improvement

### 15. Self-Ask
- Self-interrogation for problem decomposition
- Sub-question generation
- Structured sequential answering

---

## SELF-EVALUATION PROCESSES

### 16. Reflexion
- Self-reflection and self-evaluation of responses
- Self-critique process
- Capacity for iterative self-correction

### 17. Self-Refine
- Iterative cycles: generate -> critique -> revise
- Self-supervised process
- Optimisation based on internal preferences

### 18. Self-Debug
- Detection, diagnosis and repair of errors
- Internal execution simulation
- Iterative correction workflows

### 19. Self-Consistency
- Generation of multiple independent responses
- Voting / consensus process
- Aggregation via majority voting

---

## ABSTRACTION PROCESSES

### 20. Step-Back Prompting
- High-level concept abstraction
- Derivation of fundamental principles
- Restatement / decomposition at a higher level

### 21. Analogical Prompting
- Self-generation of relevant analogies
- Retrieval of relational patterns
- Cross-domain knowledge transfer

### 22. Maieutic Prompting
- Generation of a tree of recursive explanations
- Logical consistency verification
- Socratic approach to reasoning

---

## CONTRAST AND COMPARISON PROCESSES

### 23. Contrastive Chain-of-Thought
- Integration of positive and negative demonstrations
- Logit-contrast decoding
- Embedding denoising

### 24. Contrastive Prompting
- Processing of contrasting examples
- Behaviour defined by opposition
- Boundary clarification

---

## SELECTION AND OPTIMISATION PROCESSES

### 25. Complexity-Based Selection
- Selection based on reasoning complexity
- Metric: Number of Thoughts (NofT)
- Prioritisation of chains with more steps

### 26. Uncertainty-Guided Selection
- Selection based on model uncertainty
- Dynamic strategy adaptation
- Recognition of knowledge limits

### 27. Active-Prompt Selection
- Active selection based on uncertainty
- Intelligent sampling
- Focus on the most informative examples

---

## GENERATION PROCESSES

### 28. Generate (GoT Operator)
- Generation of new reasoning nodes/states
- Search-space expansion
- Creation of alternatives

### 29. Aggregate (GoT Operator)
- Aggregation of information from multiple nodes
- Knowledge fusion
- Synthesis of distributed information

### 30. Improve (GoT Operator)
- Refinement of existing nodes
- Iterative optimisation
- Quality improvement of reasoning

### 31. Score (GoT Operator)
- Quality evaluation of nodes
- Score assignment
- Ranking of alternatives

---

## VALIDATION PROCESSES

### 32. Propose (Propose-Validate-Execute)
- Proposal of actions/responses
- Candidate generation
- Execution planning

### 33. Validate (Propose-Validate-Execute)
- Validation of proposals
- Safety verification
- Constraint checking

### 34. Execute (Propose-Validate-Execute)
- Controlled execution after validation
- Implementation of approved actions
- Final output generation

---

## PLANNING PROCESSES

### 35. Planning (Plan-then-Execute)
- Strategic planning before execution
- Action-plan generation
- Approach structuring

### 36. Execution (Plan-then-Execute)
- Execution of the generated plan
- Implementation of planned steps
- Generation of structured response

---

## REFORMULATION PROCESSES

### 37. Rephrase (Rephrase-Respond)
- Reformulation of questions
- Clarification of ambiguities
- Input reinterpretation

### 38. Respond (Rephrase-Respond)
- Response after reformulation
- Generation based on clarified understanding
- Structured final output

---

## CRITIQUE PROCESSES

### 39. Critique (Constitutional AI)
- Critique based on principles
- Ethical / safety evaluation
- Problem identification

### 40. Revision (Constitutional AI)
- Revision based on the critique
- Correction of identified problems
- Alignment with principles

---

## KNOWLEDGE PROCESSES

### 41. Generated Knowledge
- Generation of relevant knowledge before responding
- Context self-augmentation
- Information enrichment

### 42. Retrieval (RAG)
- Retrieval of external information
- Search in knowledge bases
- Selection of relevant documents

### 43. Augmentation (RAG)
- Prompt augmentation with retrieved information
- Integration of external context
- Input enrichment

---

## COMPRESSION PROCESSES

### 44. Compression
- Context / prompt compression
- Redundancy removal
- Semantics preservation

### 45. Caching
- Storage of computed representations
- Reuse of repetitive prefixes
- Latency optimisation

---

## MULTIMODAL PROCESSES

### 46. Vision Encoding
- Encoding of visual inputs
- Image processing
- Visual feature extraction

### 47. Multimodal Reasoning
- Reasoning across multiple modalities
- Text + image / audio integration
- Multimodal CoT

---

## CONTROL PROCESSES

### 48. Temperature Sampling
- Randomness control during generation
- Adjustment of creativity vs coherence
- Modulation of the probability distribution

### 49. Top-K Sampling
- Limit to the K most probable tokens
- Reduction of diversity
- Focus on high probability

### 50. Top-P (Nucleus) Sampling
- Selection based on cumulative probability
- Dynamic diversity control
- Adaptation to model confidence

### 51. Logit Bias
- Adjustment of probabilities for specific tokens
- Direct intervention in the distribution
- Fine-grained vocabulary control

### 52. Reasoning Effort Control
- Control of reasoning depth
- Adjustment of computational resources
- Modulation of thought complexity

---

## ENSEMBLE PROCESSES

### 53. Voting (Ensemble)
- Voting across multiple responses
- Majority voting
- Consensus selection

### 54. Weighted Aggregation
- Weighted aggregation of outputs
- Confidence-based combination
- Fusion of multiple perspectives

### 55. Bayesian Optimization (Ensemble)
- Bayesian optimisation of aggregation
- Probabilistic selection
- Maximisation of expected performance

---

## SECURITY PROCESSES

### 56. Instruction Prioritization
- Priority ordering of instructions by hierarchy
- Differentiation of privilege levels
- Protection against injection

### 57. Delimiter Processing
- Processing of security delimiters
- Separation of instructions and data
- Context isolation

### 58. Jailbreak Detection
- Detection of bypass attempts
- Identification of attack patterns
- Exploit blocking

### 59. Backdoor Detection
- Detection of backdoors in prompts
- Identification of malicious triggers
- Integrity inspection

### 60. Confidence Calibration
- Calibration of model confidence
- Adjustment of overconfidence
- Recalibration of probabilities

---

## ALIGNMENT PROCESSES

### 61. RLAIF (RL from AI Feedback)
- Reinforcement learning with AI feedback
- Self-evaluation against principles
- Alignment optimisation

### 62. DPO (Direct Preference Optimization)
- Direct preference optimisation
- Alignment without a reward model
- Policy adjustment

---

## INTERACTION PROCESSES

### 63. Question Generation (Flipped Interaction)
- Generation of directed questions
- Inversion of interaction dynamics
- Information gathering from the user

### 64. Iterative Refinement
- Refinement through iterations
- Feedback loop with the user
- Progressive improvement

---

## PARALLELISATION PROCESSES

### 65. Batch Processing
- Processing of multiple inputs simultaneously
- Grouping of similar samples
- Throughput optimisation

### 66. Parallel Processing
- Concurrent processing of independent modules
- Parallel decomposition
- Latency reduction

### 67. Superposition Processing
- Processing along parallel paths
- Dynamic discarding of irrelevant paths
- Efficient filtering

---

## SOFT PROMPTING PROCESSES

### 68. Continuous Embedding Learning
- Learning of continuous vectors
- Prefix optimisation
- Parameter-efficient adaptation

### 69. MLP Reparameterization
- Reparameterisation via MLP
- Embedding transformation
- Representation optimisation

### 70. Dynamic Prefix Banking
- Dynamic management of prefixes
- Adaptive selection
- Reuse of learned prefixes

---

## META-LEARNING PROCESSES

### 71. Prompt Generation (Meta Prompting)
- Prompt generation by the model itself
- Prompt self-improvement
- Quality bootstrapping

### 72. Prompt Refinement (Meta Prompting)
- Refinement of generated prompts
- Iterative optimisation
- Strategy evolution

### 73. Evolutionary Search (APE)
- Evolutionary search for optimal prompts
- Genetic algorithms
- Natural selection of prompts

### 74. Gradient-Based Search (APE)
- Gradient-based search
- Continuous optimisation
- Gradient descent in prompt space

---

## AUGMENTATION PROCESSES

### 75. Paraphrasing
- Prompt paraphrasing
- Generation of variations
- Robustness testing

### 76. Taboo Words
- Incorporation of forbidden words
- Constraint testing
- Restriction validation

### 77. Chaining on Outliers
- Chaining over extreme cases
- Handling of edge cases
- Outlier robustness

---

## FRAMEWORK-SPECIFIC PROCESSES

### 78. DSPy Compilation
- Compilation of prompts into pipelines
- Automatic module optimisation
- Optimised code generation

### 79. Signature Matching (DSPy)
- Matching of input / output signatures
- Type validation
- Contract verification

### 80. Module Parameterization (DSPy)
- Module parameterisation
- Adaptive configuration
- Hyperparameter optimisation

---

## CONTEXT PROCESSES

### 81. Context Selection (LangChain)
- Selection of relevant context
- Information filtering
- Content prioritisation

### 82. Context Isolation (LangChain)
- Context isolation
- Scope separation
- Leakage prevention

### 83. Context Persistence (LangChain)
- Context persistence
- State storage
- Memory maintenance

---

## SCOPE PROCESSES

### 84. Scope Restriction
- Explicit scope restriction
- Work limitation
- Over-engineering prevention

### 85. XML Tag Processing
- Processing of structural XML tags
- Separation of instruction levels
- Privilege hierarchy

---

## MONITORING PROCESSES

### 86. Monitorability (GPT-5 Thinking)
- Exposure of the reasoning process
- Thought transparency
- Decision auditability

### 87. Logging
- Recording of operations
- Execution tracing
- Decision history

---

**TOTAL: 87 Documented Processes**

---

## NOTES

- These processes may occur sequentially, in parallel, or hierarchically
- Many processes are composed of sub-processes
- The combination of processes defines the model's reasoning strategy
- Different processes are activated depending on the prompting technique used
- In 2026, explicit control of these processes via `reasoning_effort` and structured frameworks (CTCO) is the norm

---

**Last update**: April 2026
**Source**: PROMPTS_ENGINEERING.md - Complete Prompt Engineering Guide (2026)
